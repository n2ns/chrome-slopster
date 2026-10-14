import { Check, CircleAlert, CircleCheck, Plus, Star, Trash2, UsersRound } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { DEFAULT_PERSONA_ID, createPersona, defaultPersonaFields, deletePersona, resetPersonas, setActivePersona, updatePersona, type PersonaFields } from '@/src/storage/personas';
import { AppError } from '@/src/providers/types';
import type { Persona } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { usePersonaState } from '@/src/ui/hooks';
import { LanguageSelect } from '@/src/ui/LanguageSelect';

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function PersonasSection() {
  const { value, error: loadError, reload } = usePersonaState();
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState<unknown>();

  // Run a storage action, show its error inline, and refresh the list afterwards.
  async function run(action: () => Promise<void>): Promise<boolean> {
    setError(undefined);
    let ok = true;
    try {
      await action();
    } catch (failure) {
      setError(failure);
      ok = false;
    }
    reload();
    return ok;
  }

  if (!value) {
    return (
      <section>
        <h2>
          <UsersRound className="icon" size={18} aria-hidden />
          {t('personasHeading')}
        </h2>
        {loadError ? (
          <p className="error">
            <CircleAlert className="icon" size={16} aria-hidden />
            {errorMessage(loadError)}
          </p>
        ) : (
          <p className="hint">{t('loading')}</p>
        )}
        {loadError instanceof AppError && loadError.code === 'storage-error' && (
          <div className="actions">
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (window.confirm(t('personasResetConfirm'))) void run(resetPersonas);
              }}
            >
              <Trash2 className="icon" size={16} aria-hidden />
              {t('personasReset')}
            </button>
          </div>
        )}
      </section>
    );
  }

  const { personas, activeId } = value;
  const selected = personas.find((persona) => persona.id === selectedId) ?? personas.find((persona) => persona.id === activeId) ?? personas[0];

  return (
    <section>
      <h2>
        <UsersRound className="icon" size={18} aria-hidden />
        {t('personasHeading')}
      </h2>
      <p className="hint">{t('personasIntro')}</p>
      <div className="personas">
        <ul className="persona-list">
          {personas.map((persona) => (
            <li key={persona.id}>
              <button type="button" aria-current={persona.id === selected?.id} onClick={() => setSelectedId(persona.id)}>
                <span className="persona-name">{persona.name || '—'}</span>
                {persona.id === activeId && <span className="badge">{t('personaActiveBadge')}</span>}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="persona-add"
              onClick={() =>
                run(async () => {
                  const created = await createPersona({ ...defaultPersonaFields(), name: t('personaNew') });
                  setSelectedId(created.id);
                })
              }
            >
              <Plus className="icon" size={16} aria-hidden />
              {t('personaNew')}
            </button>
          </li>
        </ul>
        {selected && (
          <PersonaEditor
            key={selected.id}
            persona={selected}
            isActive={selected.id === activeId}
            onSave={(patch) => run(async () => void (await updatePersona(selected.id, patch)))}
            onSetActive={() => run(() => setActivePersona(selected.id))}
            onDelete={() => {
              if (window.confirm(t('personaDeleteConfirm', selected.name))) void run(() => deletePersona(selected.id));
            }}
          />
        )}
      </div>
      {(error ?? loadError) !== undefined && (
        <p className="error">
          <CircleAlert className="icon" size={16} aria-hidden />
          {errorMessage(error ?? loadError)}
        </p>
      )}
    </section>
  );
}

interface EditorProps {
  persona: Persona;
  isActive: boolean;
  /** Receives only the fields changed in this form, so edits made elsewhere are kept. */
  onSave: (patch: Partial<PersonaFields>) => Promise<boolean>;
  onSetActive: () => void;
  onDelete: () => void;
}

/** Form for one persona. Mounted per persona ID, so edits elsewhere never clobber an open draft. */
function PersonaEditor({ persona, isActive, onSave, onSetActive, onDelete }: EditorProps) {
  const [draft, setDraft] = useState({
    ...persona,
    bannedWords: persona.bannedWords.join('\n'),
    customRules: persona.customRules.join('\n'),
  });
  // Latest draft for saves that run after a queued one finishes.
  const draftRef = useRef(draft);
  // Values this form last loaded or saved; only fields that differ are sent.
  const baselineRef = useRef<PersonaFields>({
    name: persona.name,
    identity: persona.identity,
    tone: persona.tone,
    replyLanguage: persona.replyLanguage,
    bannedWords: persona.bannedWords,
    customRules: persona.customRules,
    antiAiVoice: persona.antiAiVoice,
  });
  // Saves run one after another, each against the baseline the previous one left.
  const queueRef = useRef(Promise.resolve());
  const [saved, setSaved] = useState(false);
  const field = (id: string) => `persona-${id}`;

  function edit(patch: Partial<typeof draft>) {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
    setSaved(false);
  }

  /** Save the fields that differ from the baseline. On blur, nothing is written when the name is empty. */
  async function saveNow(onBlur: boolean) {
    const current = draftRef.current;
    const baseline = baselineRef.current;
    const values: PersonaFields = {
      ...baseline,
      name: current.name.trim(),
      identity: current.identity,
      tone: current.tone,
      replyLanguage: current.replyLanguage,
      bannedWords: lines(current.bannedWords),
      customRules: lines(current.customRules),
      antiAiVoice: current.antiAiVoice,
    };
    const patch = Object.fromEntries(
      (Object.keys(values) as (keyof PersonaFields)[])
        .filter((key) => JSON.stringify(values[key]) !== JSON.stringify(baseline[key]))
        .map((key) => [key, values[key]]),
    ) as Partial<PersonaFields>;
    if (Object.keys(patch).length === 0) {
      // Nothing to write; an explicit save still confirms.
      if (!onBlur) setSaved(true);
      return;
    }
    if (onBlur && !values.name) return;
    const ok = await onSave(patch);
    if (ok) baselineRef.current = values;
    setSaved(ok);
  }

  function save(onBlur: boolean) {
    queueRef.current = queueRef.current.then(() => saveNow(onBlur));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save(false);
  }

  // Any field that loses focus saves its changes.
  return (
    <form className="persona-editor" onSubmit={submit} onBlur={() => save(true)}>
      <label htmlFor={field('name')}>{t('personaName')}</label>
      <input id={field('name')} type="text" required value={draft.name} onChange={(event) => edit({ name: event.target.value })} />

      <label htmlFor={field('identity')}>{t('personaIdentity')}</label>
      <textarea id={field('identity')} value={draft.identity} onChange={(event) => edit({ identity: event.target.value })} />
      <p className="hint">{t('personaIdentityHint')}</p>

      <label htmlFor={field('tone')}>{t('personaTone')}</label>
      <textarea id={field('tone')} value={draft.tone} onChange={(event) => edit({ tone: event.target.value })} />

      <label htmlFor={field('language')}>{t('personaReplyLanguage')}</label>
      <LanguageSelect
        id={field('language')}
        value={draft.replyLanguage}
        autoLabel={t('languageFollowPost')}
        onChange={(replyLanguage) => edit({ replyLanguage })}
      />

      <label htmlFor={field('banned')}>{t('personaBannedWords')}</label>
      <textarea id={field('banned')} value={draft.bannedWords} onChange={(event) => edit({ bannedWords: event.target.value })} />
      <p className="hint">{t('onePerLineHint')}</p>

      <label htmlFor={field('rules')}>{t('personaCustomRules')}</label>
      <textarea id={field('rules')} value={draft.customRules} onChange={(event) => edit({ customRules: event.target.value })} />
      <p className="hint">{t('onePerLineHint')}</p>

      <label className="check">
        <input type="checkbox" checked={draft.antiAiVoice} onChange={(event) => edit({ antiAiVoice: event.target.checked })} />
        <span>{t('personaAntiAiVoice')}</span>
      </label>

      <div className="actions">
        <button type="submit" className="primary icon-only" aria-label={t('save')} title={t('save')}>
          <Check className="icon" size={18} aria-hidden />
        </button>
        <button type="button" className="set-active" title={t('personaSetActive')} disabled={isActive} onClick={onSetActive}>
          <Star className="icon" size={16} aria-hidden />
          <span>{t('personaSetActive')}</span>
        </button>
        <button
          type="button"
          className="danger delete"
          aria-label={t('personaDelete')}
          title={persona.id === DEFAULT_PERSONA_ID ? t('personaDefaultUndeletable') : t('personaDelete')}
          disabled={persona.id === DEFAULT_PERSONA_ID}
          onClick={onDelete}
        >
          <Trash2 className="icon" size={16} aria-hidden />
        </button>
      </div>
      {saved && (
        <p className="status">
          <CircleCheck className="icon" size={16} aria-hidden />
          {t('saved')}
        </p>
      )}
    </form>
  );
}
