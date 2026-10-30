/* Документация проектов — конфиг.
   Каждая запись = проект, чьи .md-файлы открываются на numonjonov.com/<slug>.
   Новый проект = ещё один объект в массиве; папка-заглушка <slug>/index.html
   необязательна (без неё адрес обслуживает 404.html, см. CLAUDE.md).

   slug        адрес: numonjonov.com/<slug>
   title       заголовок страницы списка
   description подзаголовок списка
   repo        owner/name на GitHub; приватный репозиторий читается только с ключом
   branch      ветка, из которой берутся и в которую коммитятся файлы
   exclude     пути, которые не показывать: 'папка/' — префикс, иначе точное имя
   featured    файлы, которые идут первыми в списке (в этом порядке) */
window.DOCS_PROJECTS = [
  {
    slug: 'sms-service',
    title: 'SMS Service',
    description: 'Oracle PL/SQL SMS module for a core banking system: sending, OTP, sms_dbo integration. Guides in Uzbek, English and Russian.',
    repo: 'numonjonov/sms-service',
    branch: 'main',
    exclude: ['node_modules/', 'target/'],
    featured: [
      'SMS_QUICKSTART_UZ.md',
      'SMS_SERVICE_GUIDE_UZ.md',
      'SMS_SERVICE_GUIDE_EN.md',
      'SMS_OTP_UZ.md',
      'SMS_RUNBOOK_UZ.md',
      'HANDOFF.md',
    ],
  },
  {
    slug: 'personal-site',
    title: 'numonjonov.com',
    description: 'This site: terminal-style portfolio on GitHub Pages, no build step. Working notes and hand-over docs.',
    repo: 'numonjonov/personal-site',
    branch: 'main',
    exclude: ['prototypes/', 'lab/'],
    featured: ['CLAUDE.md', 'HANDOFF.md'],
  },
];
