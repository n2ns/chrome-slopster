import { useState, type FormEvent } from 'react';
import { t } from '@/src/i18n';
import { createPersona, defaultPersonaFields, deletePersona, setActivePersona, updatePersona } from '@/src/storage/personas';
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
        <h2>{t('personasHeading')}</h2>
        {loadError ? <p className="error">{errorMessage(loadError)}</p> : <p className="hint">{t('loading')}</p>}
      </section>
    );
  }

  const { personas, activeId } = value;
  const selected = personas.find((persona) => persona.id === selectedId) ?? personas.find((persona) => persona.id === activeId) ?? personas[0];

  return (
    <section>
      <h2>{t('personasHeading')}</h2>
      <p className="hint">{t('personasIntro')}</p>
      <div className="personas">
        <ul className="persona-list">
          {personas.map((persona) => (
            <li key={persona.id}>
              <button type="button" aria-current={persona.id === selected?.id} onClick={() => setSelectedId(persona.id)}>
                {persona.name || '—'}
                {persona.id === activeId && <span className="badge">{t('personaActiveBadge')}</span>}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  const created = await createPersona({ ...defaultPersonaFields(), name: t('personaNew') });
                  setSelectedId(created.id);
                })
              }
            >
              + {t('personaNew')}
            </button>
          </li>
        </ul>
        {selected && (
          <PersonaEditor
            key={selected.id}
            persona={selected}
            isActive={selected.id === activeId}
            onSave={(persona) => run(async () => void (await updatePersona(persona)))}
            onSetActive={() => run(() => setActivePersona(selected.id))}
            onDelete={() => {
              if (window.confirm(t('personaDeleteConfirm', selected.name))) void run(() => deletePersona(selected.id));
            }}
          />
        )}
      </div>
      {(error ?? loadError) !== undefined && <p className="error">{errorMessage(error ?? loadError)}</p>}
    </section>
  );
}

interface EditorProps {
  persona: Persona;
  isActive: boolean;
  onSave: (persona: Persona) => Promise<boolean>;
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
  const [saved, setSaved] = useState(false);
  const field = (id: string) => `persona-${id}`;

  function edit(patch: Partial<typeof draft>) {
    setDraft({ ...draft, ...patch });
    setSaved(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await onSave({ ...draft, name: draft.name.trim(), bannedWords: lines(draft.bannedWords), customRules: lines(draft.customRules) });
    setSaved(ok);
  }

  return (
    <form className="persona-editor" onSubmit={submit}>
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
        {t('personaAntiAiVoice')}
      </label>

      <div className="actions">
        <button type="submit" className="primary">
          {t('save')}
        </button>
        <button type="button" disabled={isActive} onClick={onSetActive}>
          {t('personaSetActive')}
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          {t('personaDelete')}
        </button>
      </div>
      {saved && <p className="status">{t('saved')}</p>}
    </form>
  );
}
