import { LANGUAGE_CODES, languageName } from './labels';

interface Props {
  id: string;
  value: string;
  /** Label for the 'auto' option. */
  autoLabel: string;
  onChange: (value: string) => void;
}

/** Select a BCP 47 language or 'auto'. Keeps an unlisted stored value selectable. */
export function LanguageSelect({ id, value, autoLabel, onChange }: Props) {
  const codes = value === 'auto' || LANGUAGE_CODES.includes(value) ? LANGUAGE_CODES : [...LANGUAGE_CODES, value];
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="auto">{autoLabel}</option>
      {codes.map((code) => (
        <option key={code} value={code}>
          {languageName(code)}
        </option>
      ))}
    </select>
  );
}
