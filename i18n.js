/* =========================================================
   Переводы: English (по умолчанию), Русский, Oʻzbekcha.

   Как править: нашли нужный блок — поправили текст во всех трёх
   словарях. Названия команд (help, about, projects…) не переводятся:
   это команды, их набирают одинаково на любом языке.

   Порядок элементов в projects.items и experience.items должен
   совпадать с порядком в site.js.
   ========================================================= */
window.I18N = {

  /* ===================== ENGLISH ===================== */
  en: {
    ui: {
      skip: 'Skip to the command line',
      placeholder: 'type help and press enter',
      themeLabel: 'Toggle theme',
      statusLang: 'lang', statusTheme: 'theme', statusBg: 'bg', statusHint: 'try',
      boot1: '{handle} {version} — personal terminal',
      boot2: 'type <b>help</b> for the list of commands',
      notFound: 'command not found:',
      notFoundHint: 'type <b>help</b> to see what works',
      featured: 'featured',
      langChanged: 'language →',
      themeChanged: 'theme →',
      langUsage: 'usage: lang en | ru | uz',
      themeUsage: 'usage: theme light | dark',
      openUsage: 'usage: open 001 | 002',
      openMissing: 'no project with id',
      opening: 'opening',
      sudo: 'nice try. permission denied — but I like the way you think.',
      konami: 'up up down down left right left right b a — you know your classics.',
      bgChanged: 'background →',
      bgUsage: 'usage: bg on | off',
      bgMissing: 'background is not available here',
      cursorChanged: 'cursor →',
      cursorUsage: 'usage: cursor on | off',
      cursorMissing: 'custom cursor is not available on touch screens'
    },

    help: {
      intro: 'Available commands:',
      rows: [
        ['whoami',     'who I am, in one line'],
        ['about',      'longer intro and basic facts'],
        ['experience', 'where I worked and studied'],
        ['projects',   'selected work with links'],
        ['skills',     'what I use day to day'],
        ['contact',    'email and social links'],
        ['open <id>',  'open a project link, e.g. open 001'],
        ['lang <code>','switch language: en, ru, uz'],
        ['theme',      'switch light / dark'],
        ['bg',         'cycle background style, or jump to one: tunnel, stars, matrix, meteor, horizon, web'],
        ['cursor',     'terminal-style cursor on or off'],
        ['clear',      'clear the screen']
      ],
      footer: 'Tip: ↑ and ↓ walk through history, Tab completes a command.'
    },

    whoami: {
      role: 'dev',
      line: 'backend'
    },

    about: {
      paragraphs: [
        '---------------------'
      ],
      facts: [
        ['location',  'Tashkent'],
        ['status',    'employed'],
        ['languages', 'Oʻzbekcha / Русский / English']
      ]
    },

    experience: {
      items: [
        { role: 'sqb', org: '', text: '' }
      ]
    },

    projects: {
      items: [
        { title: 'MyID', text: 'Closed-source project.' },
        { title: 'eKey', text: 'Closed-source project.' }
      ],
      linkLabels: { demo: 'live demo', code: 'source', more: 'read more' },
      note: 'Closed-source — no public links to open.'
    },

    skills: {
      groups: ['development', 'tools', 'other'],
      extra: ['communication', 'english']
    },

    contact: {
      lead: '',
      labels: { email: 'email', github: 'github', telegram: 'telegram', linkedin: 'linkedin' }
    }
  },

  /* ===================== РУССКИЙ ===================== */
  ru: {
    ui: {
      skip: 'Перейти к командной строке',
      placeholder: 'наберите help и нажмите enter',
      themeLabel: 'Переключить тему',
      statusLang: 'язык', statusTheme: 'тема', statusBg: 'фон', statusHint: 'наберите',
      boot1: '{handle} {version} — личный терминал',
      boot2: 'наберите <b>help</b>, чтобы увидеть список команд',
      notFound: 'команда не найдена:',
      notFoundHint: 'наберите <b>help</b> — там список рабочих команд',
      featured: 'главный',
      langChanged: 'язык →',
      themeChanged: 'тема →',
      langUsage: 'как пользоваться: lang en | ru | uz',
      themeUsage: 'как пользоваться: theme light | dark',
      openUsage: 'как пользоваться: open 001 | 002',
      openMissing: 'нет проекта с номером',
      opening: 'открываю',
      sudo: 'хорошая попытка. доступ запрещён — но ход мысли мне нравится.',
      konami: '↑↑↓↓←→←→ b a — классику знаешь.',
      bgChanged: 'фон →',
      bgUsage: 'как пользоваться: bg on | off',
      bgMissing: 'фон здесь недоступен',
      cursorChanged: 'курсор →',
      cursorUsage: 'как пользоваться: cursor on | off',
      cursorMissing: 'свой курсор на сенсорных экранах недоступен'
    },

    help: {
      intro: 'Доступные команды:',
      rows: [
        ['whoami',     'кто я, одной строкой'],
        ['about',      'подробнее о себе и основные факты'],
        ['experience', 'где работал и учился'],
        ['projects',   'избранные проекты со ссылками'],
        ['skills',     'чем пользуюсь каждый день'],
        ['contact',    'почта и ссылки'],
        ['open <id>',  'открыть ссылку проекта, например open 001'],
        ['lang <code>','сменить язык: en, ru, uz'],
        ['theme',      'светлая / тёмная тема'],
        ['bg',         'перебор стилей фона, или сразу нужный: tunnel, stars, matrix, meteor, horizon, web'],
        ['cursor',     'свой курсор — включить или выключить'],
        ['clear',      'очистить экран']
      ],
      footer: 'Подсказка: ↑ и ↓ листают историю, Tab дополняет команду.'
    },

    whoami: {
      role: 'dev',
      line: 'backend'
    },

    about: {
      paragraphs: [
        '---------------------'
      ],
      facts: [
        ['локация', 'Ташкент'],
        ['статус',  'работает'],
        ['языки',   'Oʻzbekcha / Русский / English']
      ]
    },

    experience: {
      items: [
        { role: 'sqb', org: '', text: '' }
      ]
    },

    projects: {
      items: [
        { title: 'MyID', text: 'Закрытый проект.' },
        { title: 'eKey', text: 'Закрытый проект.' }
      ],
      linkLabels: { demo: 'демо', code: 'код', more: 'подробнее' },
      note: 'Закрытый исходный код — публичных ссылок нет.'
    },

    skills: {
      groups: ['разработка', 'инструменты', 'прочее'],
      extra: ['коммуникация', 'английский']
    },

    contact: {
      lead: '',
      labels: { email: 'почта', github: 'github', telegram: 'telegram', linkedin: 'linkedin' }
    }
  },

  /* ===================== OʻZBEKCHA ===================== */
  uz: {
    ui: {
      skip: 'Buyruq satriga oʻtish',
      placeholder: 'help deb yozing va enter bosing',
      themeLabel: 'Mavzuni almashtirish',
      statusLang: 'til', statusTheme: 'mavzu', statusBg: 'fon', statusHint: 'yozing',
      boot1: '{handle} {version} — shaxsiy terminal',
      boot2: 'buyruqlar roʻyxati uchun <b>help</b> deb yozing',
      notFound: 'buyruq topilmadi:',
      notFoundHint: 'ishlaydigan buyruqlar uchun <b>help</b> deb yozing',
      featured: 'asosiy',
      langChanged: 'til →',
      themeChanged: 'mavzu →',
      langUsage: 'qoʻllanishi: lang en | ru | uz',
      themeUsage: 'qoʻllanishi: theme light | dark',
      openUsage: 'qoʻllanishi: open 001 | 002',
      openMissing: 'bunday raqamli loyiha yoʻq:',
      opening: 'ochilmoqda',
      sudo: 'urinish yaxshi. ruxsat yoʻq — lekin fikringiz menga yoqdi.',
      konami: '↑↑↓↓←→←→ b a — klassikani bilar ekansiz.',
      bgChanged: 'fon →',
      bgUsage: 'qoʻllanishi: bg on | off',
      bgMissing: 'bu yerda fon mavjud emas',
      cursorChanged: 'kursor →',
      cursorUsage: 'qoʻllanishi: cursor on | off',
      cursorMissing: 'sensorli ekranlarda oʻz kursori mavjud emas'
    },

    help: {
      intro: 'Mavjud buyruqlar:',
      rows: [
        ['whoami',     'men kimman, bir satrda'],
        ['about',      'oʻzim haqimda batafsil va asosiy maʼlumotlar'],
        ['experience', 'qayerda ishlaganman va oʻqiganman'],
        ['projects',   'tanlangan loyihalar va havolalar'],
        ['skills',     'har kuni nimadan foydalanaman'],
        ['contact',    'pochta va havolalar'],
        ['open <id>',  'loyiha havolasini ochish, masalan open 001'],
        ['lang <code>','tilni almashtirish: en, ru, uz'],
        ['theme',      'yorugʻ / qorongʻi mavzu'],
        ['bg',         'fon uslubini almashtirish, yoki toʻgʻridan-toʻgʻri: tunnel, stars, matrix, meteor, horizon, web'],
        ['cursor',     'oʻz kursorini yoqish yoki oʻchirish'],
        ['clear',      'ekranni tozalash']
      ],
      footer: 'Maslahat: ↑ va ↓ tarixni varaqlaydi, Tab buyruqni toʻldiradi.'
    },

    whoami: {
      role: 'dev',
      line: 'backend'
    },

    about: {
      paragraphs: [
        '---------------------'
      ],
      facts: [
        ['manzil', 'Toshkent'],
        ['holat',  'ishlaydi'],
        ['tillar', 'Oʻzbekcha / Русский / English']
      ]
    },

    experience: {
      items: [
        { role: 'sqb', org: '', text: '' }
      ]
    },

    projects: {
      items: [
        { title: 'MyID', text: 'Yopiq loyiha.' },
        { title: 'eKey', text: 'Yopiq loyiha.' }
      ],
      linkLabels: { demo: 'demo', code: 'kod', more: 'batafsil' },
      note: 'Yopiq manba — ochiq havolalar yoʻq.'
    },

    skills: {
      groups: ['dasturlash', 'vositalar', 'boshqa'],
      extra: ['muloqot', 'ingliz tili']
    },

    contact: {
      lead: '',
      labels: { email: 'pochta', github: 'github', telegram: 'telegram', linkedin: 'linkedin' }
    }
  }
};
