/* =========================================================
   Данные, одинаковые для всех языков: ссылки, теги, даты, id.
   Тексты к ним лежат в i18n.js в том же порядке.

   Правило: i-й проект здесь — это i-й проект в i18n.projects.
   Добавляете проект тут — добавьте описание во все три словаря.
   ========================================================= */
window.SITE = {
  name: 'Pahlavon Numonjonov',

  /* Приглашение терминала в формате «пользователь@машина».
     Отсюда оно попадает и в заголовок окна, и в первую строку при запуске. */
  handle: 'pahlavon@numonjonov.com',
  version: 'v1.0',

  /* Если оставить пустым, в выводе contact вместо адреса будет прочерк. */
  email: 'pahlavon@numonjonov.com',

  /* label — как ссылка выглядит на экране. Если его нет, показывается сам адрес.
     spoilerChars — сколько символов после label спрятать под «шум». Реальный
     хэндл нигде не хранится: href ведёт на корень домена, не на профиль —
     иначе он всё равно был бы виден в HTML и в статус-баре при наведении. */
  socials: [
    { key: 'github',   url: 'https://github.com', label: 'github.com/', spoilerChars: 10 },
    { key: 'telegram', url: 'https://t.me',        label: 't.me/',       spoilerChars: 16 },
    { key: 'linkedin', url: 'https://linkedin.com', label: 'linkedin.com/', spoilerChars: 10 }
  ],

  /* spoiler: true — абзацы about печатаются «шумом», как спойлер в Телеграме.
     Впишете настоящий текст — уберите флаг. */
  about: { spoiler: true },

  experience: [
    { date: '' }
  ],

  projects: [
    {
      id: '001',
      featured: true,
      tags: ['java', 'spring boot'],
      links: []
    },
    {
      id: '002',
      tags: ['jsp', 'weblogic'],
      links: []
    }
  ],

  /* Группа — либо простой массив, либо { items, spoiler }.
     spoiler: true прячет значение под «шум», как спойлер в Телеграме.
     Впишете настоящие навыки — уберите флаг. */
  skills: [
    { spoiler: true, items: ['----------------------'] },
    { spoiler: true, items: ['----------------------'] },
    { spoiler: true, items: ['----------------------'] }
  ]
};
