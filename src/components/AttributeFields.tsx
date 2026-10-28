import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { heError } from '../lib/errors';

// The table-driven parameters of a player or team (0008, 0023): each field is a row in attribute_defs, and the
// server decides which ones apply, who sees them and who may change them.
interface Attr {
  def_id: string;
  key: string;
  label_he: string;
  data_type: 'text' | 'number' | 'scale' | 'boolean' | 'date' | 'select' | 'lookup';
  config: { options?: string[]; domain?: string; min?: number; max?: number; placeholder?: string };
  value: unknown;
  can_write: boolean;
}

type Options = Record<string, { id: string; name_he: string }[]>;

export default function AttributeFields({ scope, entityId }: { scope: 'player' | 'team'; entityId: string }) {
  const [attrs, setAttrs] = useState<Attr[] | null>(null);
  const [options, setOptions] = useState<Options>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('entity_attributes', { p_scope: scope, p_entity: entityId }).then(async ({ data }) => {
      const list = (data as Attr[] | null) ?? [];
      setAttrs(list);
      const domains = [...new Set(list.filter((a) => a.data_type === 'lookup').map((a) => a.config.domain!))];
      if (domains.length) {
        const { data: rows } = await supabase
          .from('lookups')
          .select('id, name_he, domain')
          .in('domain', domains)
          .eq('active', true)
          .order('sort_order');
        const byDomain: Options = {};
        for (const r of (rows as { id: string; name_he: string; domain: string }[] | null) ?? []) {
          (byDomain[r.domain] ??= []).push(r);
        }
        setOptions(byDomain);
      }
    });
  }, [scope, entityId]);

  async function save(a: Attr, value: unknown) {
    if (value === a.value || (value === null && a.value == null)) return;
    setError(null);
    const { error: err } = await supabase.rpc('set_attribute', { p_def: a.def_id, p_entity: entityId, p_value: value });
    if (err) return setError(`${a.label_he}: ${heError(err, 'הערך לא נשמר')}`);
    setAttrs((list) => list?.map((x) => (x.def_id === a.def_id ? { ...x, value } : x)) ?? null);
    setSaved(a.label_he);
    setTimeout(() => setSaved(null), 1500);
  }

  if (!attrs) return <p>טוען…</p>;
  if (attrs.length === 0) return null;

  return (
    <div className="fields">
      {attrs.map((a) => (
        <Field key={a.def_id} attr={a} options={options[a.config.domain ?? ''] ?? []} onSave={(v) => save(a, v)} />
      ))}
      <p className="hint" role="status">{saved ? `נשמר: ${saved}` : ''}</p>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}

function display(a: Attr, options: { id: string; name_he: string }[]): string {
  if (a.value == null || a.value === '') return '—';
  if (a.data_type === 'boolean') return a.value ? 'כן' : 'לא';
  if (a.data_type === 'lookup') return options.find((o) => o.id === a.value)?.name_he ?? '—';
  if (a.data_type === 'date') return new Date(String(a.value)).toLocaleDateString('he-IL');
  return String(a.value);
}

function Field({
  attr: a,
  options,
  onSave,
}: {
  attr: Attr;
  options: { id: string; name_he: string }[];
  onSave: (v: unknown) => void;
}) {
  const id = `attr-${a.def_id}`;
  const [text, setText] = useState(a.value == null ? '' : String(a.value));
  useEffect(() => setText(a.value == null ? '' : String(a.value)), [a.value]);

  if (!a.can_write) {
    return (
      <div className="field">
        <span className="label">{a.label_he}</span>
        <span>{display(a, options)}</span>
      </div>
    );
  }

  const empty = (v: string) => (v.trim() === '' ? null : v.trim());
  let control;
  switch (a.data_type) {
    case 'boolean':
      return (
        <label className="switch field">
          <input type="checkbox" checked={a.value === true} onChange={(e) => onSave(e.target.checked)} />
          {a.label_he}
        </label>
      );
    case 'select':
    case 'lookup': {
      const items =
        a.data_type === 'select'
          ? (a.config.options ?? []).map((o) => ({ id: o, name_he: o }))
          : options;
      control = (
        <select id={id} value={text} onChange={(e) => onSave(e.target.value || null)}>
          <option value="">—</option>
          {items.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name_he}
            </option>
          ))}
        </select>
      );
      break;
    }
    case 'number':
    case 'scale':
      control = (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={a.config.min}
          max={a.config.max}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onSave(text.trim() === '' ? null : Number(text))}
        />
      );
      break;
    case 'date':
      control = (
        <input id={id} type="date" value={text} onChange={(e) => onSave(e.target.value || null)} />
      );
      break;
    default:
      control = (
        <input
          id={id}
          value={text}
          placeholder={a.config.placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onSave(empty(text))}
        />
      );
  }
  return (
    <div className="field">
      <label htmlFor={id} className="label">
        {a.label_he}
      </label>
      {control}
    </div>
  );
}
