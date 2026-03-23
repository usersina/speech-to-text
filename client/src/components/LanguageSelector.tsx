import Select, { type SingleValue } from 'react-select'

function titleCase(str: string) {
  str = str.toLowerCase()
  return (str.match(/\w+.?/g) || [])
    .map((word) => {
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join('')
}

const LANGUAGES: Record<string, string> = {
  en: 'english',
  zh: 'chinese',
  de: 'german',
  es: 'spanish/castilian',
  ru: 'russian',
  ko: 'korean',
  fr: 'french',
  ja: 'japanese',
  pt: 'portuguese',
  tr: 'turkish',
  pl: 'polish',
  ca: 'catalan/valencian',
  nl: 'dutch/flemish',
  ar: 'arabic',
  sv: 'swedish',
  it: 'italian',
  id: 'indonesian',
  hi: 'hindi',
  fi: 'finnish',
  vi: 'vietnamese',
  he: 'hebrew',
  uk: 'ukrainian',
  el: 'greek',
  ms: 'malay',
  cs: 'czech',
  ro: 'romanian/moldavian/moldovan',
  da: 'danish',
  hu: 'hungarian',
  ta: 'tamil',
  no: 'norwegian',
  th: 'thai',
  ur: 'urdu',
  hr: 'croatian',
  bg: 'bulgarian',
  lt: 'lithuanian',
  la: 'latin',
  mi: 'maori',
  ml: 'malayalam',
  cy: 'welsh',
  sk: 'slovak',
  te: 'telugu',
  fa: 'persian',
  lv: 'latvian',
  bn: 'bengali',
  sr: 'serbian',
  az: 'azerbaijani',
  sl: 'slovenian',
  kn: 'kannada',
  et: 'estonian',
  mk: 'macedonian',
  br: 'breton',
  eu: 'basque',
  is: 'icelandic',
  hy: 'armenian',
  ne: 'nepali',
  mn: 'mongolian',
  bs: 'bosnian',
  kk: 'kazakh',
  sq: 'albanian',
  sw: 'swahili',
  gl: 'galician',
  mr: 'marathi',
  pa: 'punjabi/panjabi',
  si: 'sinhala/sinhalese',
  km: 'khmer',
  sn: 'shona',
  yo: 'yoruba',
  so: 'somali',
  af: 'afrikaans',
  oc: 'occitan',
  ka: 'georgian',
  be: 'belarusian',
  tg: 'tajik',
  sd: 'sindhi',
  gu: 'gujarati',
  am: 'amharic',
  yi: 'yiddish',
  lo: 'lao',
  uz: 'uzbek',
  fo: 'faroese',
  ht: 'haitian creole/haitian',
  ps: 'pashto/pushto',
  tk: 'turkmen',
  nn: 'nynorsk',
  mt: 'maltese',
  sa: 'sanskrit',
  lb: 'luxembourgish/letzeburgesch',
  my: 'myanmar/burmese',
  bo: 'tibetan',
  tl: 'tagalog',
  mg: 'malagasy',
  as: 'assamese',
  tt: 'tatar',
  haw: 'hawaiian',
  ln: 'lingala',
  ha: 'hausa',
  ba: 'bashkir',
  jw: 'javanese',
  su: 'sundanese',
}

export function LanguageSelector({
  language,
  setLanguage,
}: {
  language: string
  setLanguage: (_value: string) => void
}) {
  type Option = { value: string; label: string }

  const options: Option[] = Object.entries(LANGUAGES).map(([k, v]) => ({
    value: k,
    label: titleCase(v),
  }))

  const handleChange = (opt: SingleValue<Option>) => {
    if (opt) setLanguage(opt.value)
  }

  const value = options.find((o) => o.value === language) ?? options[0]

  return (
    <div style={{ minWidth: 140 }}>
      <Select<Option, false>
        options={options}
        value={value}
        onChange={handleChange}
        isSearchable
        menuPortalTarget={
          typeof document !== 'undefined' ? document.body : undefined
        }
        menuPosition="fixed"
        styles={{
          container: (base) => ({ ...base }),
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
          menu: (base) => ({
            ...base,
            whiteSpace: 'normal',
            overflowX: 'hidden',
          }),
          option: (base, state) => ({
            ...base,
            color: state.isSelected ? '#fff' : '#111827',
            backgroundColor: state.isSelected
              ? '#2563eb'
              : base.backgroundColor,
            whiteSpace: 'normal',
            wordWrap: 'break-word',
          }),
          singleValue: (base) => ({ ...base, color: '#111827' }),
        }}
      />
    </div>
  )
}
