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

  /* label — как ссылка выглядит на экране. Если его нет, показывается сам адрес. */
  socials: [
    { key: 'github',   url: 'https://github.com/numonjonov' },
    { key: 'telegram', url: 'https://t.me/CustomAnnotation' },
    { key: 'linkedin', url: 'https://linkedin.com/' }
  ],

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

  skills: [
    ['----------------------'],
    ['----------------------'],
    ['----------------------']
  ]
};
