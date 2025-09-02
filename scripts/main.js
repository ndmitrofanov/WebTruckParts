// Minimal, autonomous logic for catalog search, suggestions, DataTables and modal.
(function () {
  const $input        = $('#search-input');
  const $btnSearch    = $('#search-btn');
  const $btnAll       = $('#show-all');
  const $clearBtn     = $('#clear-search');
  const $suggestions  = $('#suggestions');
  const $tableWrap    = $('#table-wrap');
  const $modal        = $('#modal');
  const $modalImg     = $('#modal-img');
  const $note         = $('#purchase-note');
  const $loading = $('#loading-indicator');
  const $results = $('#results'); // контейнер с анимацией

  const CONTACTS = {
    phone: '+7 (999) 123-45-67',
    email: 'parts@example.com'
  };

  let DATA = []; // единый массив данных
  let isCatalogOpen = false;
  let isAnimating = false;
  let dt;

  // Блокируем кнопки до загрузки JSON
  $btnSearch.prop('disabled', true);
  $btnAll.prop('disabled', true);

  // Загружаем единый файл с двумя массивами: parts и cards
  $.getJSON('/data/parts.json')
    .done(function(json) {
      // Диагностика структуры JSON
      console.group('Диагностика parts.json');
      console.log('JSON:', json);

      if (!json) {
        console.error('JSON пустой или не загружен');
        console.groupEnd();
        return;
      }
      if (!Array.isArray(json.cards)) {
        console.error('json.cards не массив:', json.cards);
      } else {
        console.log('json.cards ОК, длина:', json.cards.length);
      }
      if (!Array.isArray(json.parts)) {
        console.error('json.parts не массив:', json.parts);
      } else {
        console.log('json.parts ОК, длина:', json.parts.length);
      }

      // Проверка структуры элементов parts
      if (Array.isArray(json.parts)) {
        json.parts.forEach((item, idx) => {
          if (!item.code || !item.name || !item.photo) {
            console.warn(`Элемент parts[${idx}] не содержит всех полей:`, item);
          }
        });
      }

      // Проверка наличия контейнера для карточек
      const container = document.getElementById('cards-wrap');
      if (!container) {
        console.error('Не найден элемент #cards-wrap в DOM');
      } else {
        console.log('Элемент #cards-wrap найден');
      }
      console.groupEnd();

      // 1) Рендерим карточки из json.cards
      renderCards(json.cards);

      // 2) Подготовка массива деталей для поиска и таблицы
      DATA = json.parts;

      // 3) Ваша валидация массива DATA и разблокировка форм
      try {
        if (!Array.isArray(DATA)) throw new Error('DATA не массив');
        // Проверка на пустоту
        if (DATA.length === 0) throw new Error('DATA пустой');
      } catch (e) {
        console.error('Проблема с JSON:', e.message);
      }
      $btnSearch.prop('disabled', false);
      $btnAll    .prop('disabled', false);
      $input     .prop('disabled', false);
  })
  .fail(function(jqXHR, textStatus, errorThrown) {
    console.error('Не удалось загрузить parts.json:', textStatus, errorThrown);
  });

  // Заглушка (можешь оставить как есть)
  const PLACEHOLDER_SRC =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480'%3E%3Crect width='100%25' height='100%25' fill='%23eeeeee'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999999' font-family='Verdana' font-size='26'%3E%D0%9D%D0%95%D0%A2%20%D0%A4%D0%9E%D0%A2%D0%9E%3C/text%3E%3C/svg%3E";
  
  $(document).ready(function() {
    // 1) Инициализация DataTable — таблица пуста, но объект готов к заполнению
    dt = $('#parts-table').DataTable({
      data: [],
      columns: [
        { data: 'code',  title: 'Код' },
        {
          data: 'photo',
          title: 'Фото',
          orderable: false,
          searchable: false,
          render: function (src, type, row) {
            if (type !== 'display') return src || '';

            const safeSrc = src ? escapeHtml(src) : PLACEHOLDER_SRC;
            const img = document.createElement('img');
            img.className = 'thumb';
            img.src       = safeSrc;
            img.alt       = `Фото ${escapeHtml(row.code)}`;
            img.onerror   = function () {
              this.onerror = null;
              this.src     = PLACEHOLDER_SRC;
            };
            return img.outerHTML;
          }
        },
        { data: 'name', title: 'Наименование' }
      ],
      pageLength: 25,
      lengthMenu: [[10,20,50,-1],[10,20,50,'Все']],
      order: [[0,'asc']],
      autoWidth: false,
      searching: false,
      language: {
        emptyTable: 'Нет данных',
        info:       'Показаны записи: _START_-_END_ из _TOTAL_',
        infoEmpty:  '0 записей',
        paginate:   { previous: 'Назад', next: 'Вперёд' }
      },
      dom: 'tip'
    });

    // 3) При поиске/«Показать все» заполняем уже готовый dt
    $('#search-btn').on('click', function() {
      const term = $input.val().trim().toLowerCase();
      const rows = DATA.filter(item =>
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term)
      );
      showRows(rows);
    });

    // По нажатию Enter в инпуте запускаем поиск
    $input.on('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#search-btn').trigger('click');
      }
    });
  });

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /**
   * Отрисовка карточек в #cards-wrap
   */
  
  // Функция рендера
  function renderCards(cards) {
    if (!Array.isArray(cards)) {
      console.warn('Нет массива карточек для рендера', cards);
      return;
    }

    const container = document.getElementById('cards-wrap');
    if (!container) {
      console.error('Не найден элемент #cards-wrap');
      return;
    }
    container.innerHTML = '';

    cards.forEach(card => {
      const photoSrc = card.photo ? escapeHtml(card.photo) : PLACEHOLDER_SRC;
      const code  = card.code  ? escapeHtml(card.code)  : '';
      const title = card.name  ? escapeHtml(card.name)  : '';
      const desc  = card.desc  ? escapeHtml(card.desc)  : '';

      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.innerHTML = `
        <img class="card-img" src="${photoSrc}" alt="${title || 'Фото запчасти'}" loading="lazy" />
        ${code  ? `<div class="card-code">Код: ${code}</div>` : ''}
        ${title ? `<div class="card-title">${title}</div>` : ''}
        ${desc  ? `<div class="card-desc">${desc}</div>` : ''}
        <button class="card-button" type="button">Посмотреть</button>
      `;
      cardEl.querySelector('.card-img').onclick =
      cardEl.querySelector('.card-button').onclick = () => openModal(photoSrc);

      container.append(cardEl);
    });
  }

  function showRows(rows) {
    console.group('→ showRows debug');
  
    console.log('rows.length =', rows.length);
  
    // лог до удаления класса
    console.log('$tableWrap before removeClass:', {
      classes:    $tableWrap.attr('class'),
      styleAttr:  $tableWrap.attr('style'),
      computed:   getComputedStyle($tableWrap[0]).display
    });
  
    // обновляем таблицу
    dt.clear();
    dt.rows.add(rows);
    dt.draw();
  
    // снимаем скрытие
    $tableWrap.removeClass('hidden').show();
    $note     .removeClass('hidden').show();
  
    // Скрываем карточки при показе таблицы
    $('#cards-wrap').addClass('hidden');
  
    // лог после удаления класса
    console.log('$tableWrap after removeClass:', {
      hasClass:   $tableWrap.hasClass('hidden'),
      classes:    $tableWrap.attr('class'),
      styleAttr:  $tableWrap.attr('style'),
      computed:   getComputedStyle($tableWrap[0]).display
    });
  
    console.groupEnd();
  }

  function filterData(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return DATA.filter(item => {
      const code = item.code.toLowerCase();
      const name = item.name.toLowerCase();
      return code.startsWith(q)  // код начинается с q
          || name.startsWith(q); // имя тоже начинается с q
    });
  }

  let suggestTimer = null;
  $input.on('input', function () {
    const val = $input.val().trim();
    $clearBtn.toggle(!!val);
    clearTimeout(suggestTimer);
    
    if (!val) {
      $suggestions.addClass('hidden').empty();
      return;
    }
    suggestTimer = setTimeout(() => {
      const list = filterData(val).slice(0, 8);
      renderSuggestions(list, val);
    }, 90);
  });

  function renderSuggestions(items, q) {
    if (!items.length) {
      $suggestions
        .removeClass('hidden')
        .html(`<div class="suggestion-item"><span class="suggestion-name">Ничего не найдено</span></div>`);
      return;
    }
    const qLower = q.toLowerCase();
    const html = items.map(it => `
      <div class="suggestion-item" data-code="${escapeHtml(it.code)}">
        <span class="suggestion-code">${highlight(it.code, qLower, true)}</span>
        <span class="suggestion-name">${highlight(it.name, qLower, false)}</span>
      </div>`).join('');
    $suggestions.removeClass('hidden').html(html);
  }

  function highlight(text, qLower, isCode) {
    const src = String(text);
    if (isCode) {
      const prefix = src.slice(0, qLower.length);
      if (prefix.toLowerCase() === qLower) {
        return `<mark>${escapeHtml(prefix)}</mark>${escapeHtml(src.slice(qLower.length))}`;
      }
      return escapeHtml(src);
    } else {
      const idx = src.toLowerCase().indexOf(qLower);
      if (idx === -1) return escapeHtml(src);
      const before = src.slice(0, idx);
      const match = src.slice(idx, idx + qLower.length);
      const after = src.slice(idx + qLower.length);
      return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
    }
  }

  $suggestions.on('click', '.suggestion-item', function () {
    const code = $(this).data('code');
    if (!code) return;
    $input.val(code);
    $clearBtn.show();
    $suggestions.addClass('hidden').empty();
    doSearch({ query: code, openIfSingle: false, exact: true });
  });

  $(document).on('click', function (e) {
    if (!$(e.target).closest('.searchbar').length) {
      $suggestions.addClass('hidden').empty();
    }
  });

  $clearBtn.on('click', function () {
    $input.val('');
    $clearBtn.hide();
    $suggestions.addClass('hidden').empty();
    $tableWrap.addClass('hidden');
    $note.addClass('hidden');
    hideTableAndShowCards(); // показываем карточки обратно
  });

  $btnSearch.on('click', function() {
    const q = $input.val().trim();
    doSearch({ query: q, exact: false, openIfSingle: false });
  });

  $input.on('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = $input.val().trim();
      doSearch({ query: q, exact: false, openIfSingle: false });
    }
  });

function doSearch(opts = {}) {
  // 1. Подготовка аргументов
  $suggestions.addClass('hidden').empty();
  const { query, exact = false, openIfSingle = false } = opts;
  const val = (query !== undefined ? String(query) : $input.val()).trim();

  // 2. Если пустой запрос — скрываем таблицу и выходим
  if (!val) {
    $tableWrap.addClass('hidden');
    $note.addClass('hidden');
    return;
  }

  // 3. Фильтрация данных
  const qLower = val.toLowerCase();
  let rows;
  if (exact) {
    rows = DATA.filter(item =>
      item.code.toLowerCase() === qLower ||
      item.name.toLowerCase() === qLower
    );
  } else {
    rows = filterData(val);
  }

  // 4. Рендерим строки в таблице
  showRows(rows);

  // 5. Авто-открытие контейнера с результатами
  if (rows.length > 0 && !isCatalogOpen && !isAnimating) {
    const el = $results[0];
    isAnimating = true;

    // Начинаем из высоты 0 и сразу ставим класс .open
    $results.css('height', '0').addClass('open');

    // В следующем кадре плавно развернём до полной высоты
    requestAnimationFrame(() => {
      $results.css('height', el.scrollHeight + 'px');
    });

    // После окончания transition — фиксируем auto и сбрасываем флаги
    $results.one('transitionend', () => {
      $results.css('height', 'auto');
      isAnimating = false;
      isCatalogOpen = true;
    });
  }

  // 6. Открываем модалку, если один результат и опция openIfSingle=true
  if (openIfSingle && rows.length === 1) {
    openModal(rows[0].photo || PLACEHOLDER_SRC);
  }
}


  $btnAll.on('click', function () {
  if (isAnimating) return;

  const el = $results[0];

  if (!isCatalogOpen) {
    // Открываем таблицу, скрываем карточки
    $input.val('');
    $clearBtn.hide();
    $suggestions.addClass('hidden').empty();

    showRows(DATA);

    $tableWrap.removeClass('hidden');
    $note.removeClass('hidden');
    $('#cards-wrap').addClass('hidden');

    // Анимация открытия
    isAnimating = true;
    $results.css('height', '0').addClass('open');
    requestAnimationFrame(() => {
      $results.css('height', el.scrollHeight + 'px');
    });
    $results.one('transitionend', () => {
      $results.css('height', 'auto');
      isAnimating = false;
      isCatalogOpen = true;
    });

  } else {
    // Закрываем таблицу, показываем карточки
    isAnimating = true;
    const current = el.getBoundingClientRect().height;
    $results.css('height', current + 'px');
    requestAnimationFrame(() => {
      $results.css('height', '0').removeClass('open');
    });
    $results.one('transitionend', () => {
      $tableWrap.addClass('hidden');
      $note.addClass('hidden');
      $('#cards-wrap').removeClass('hidden');
      if ($.fn.dataTable.isDataTable('#parts-table')) {
        $('#parts-table').DataTable().clear().draw();
      }
      isAnimating = false;
      isCatalogOpen = false;
    });
  }
});

  $('#parts-table tbody').on('click', 'img.thumb', function (e) {
    e.preventDefault();
    openModal($(this).attr('src'));
  });

  $('.close').on('click', closeModal);
  $modal.on('click', function (e) {
    if (e.target === this) closeModal();
  });
  $(document).on('keydown', function (e) {
    if (e.key === 'Escape' && $modal.hasClass('open')) closeModal();
  });

  new Image().src = PLACEHOLDER_SRC;
  $('#modal-img').on('click', closeModal);

  // Возврат фокуса после закрытия
  let lastFocusEl = null;
  function openModal(src) {
    lastFocusEl = document.activeElement;
    $modalImg.attr('src', src || PLACEHOLDER_SRC);
    $modal.addClass('open').attr('aria-hidden', 'false');
    $('body').addClass('no-scroll');

    // Скрываем контактные кнопки
    $('.contact-actions').addClass('hidden');
  }

  function closeModal() {
    $modal.removeClass('open').attr('aria-hidden', 'true');
    $modalImg.attr('src', '');
    $('body').removeClass('no-scroll');

    // Показываем контактные кнопки обратно (если нужно в будущем)
    $('.contact-actions').removeClass('hidden');

    if (lastFocusEl && document.contains(lastFocusEl)) lastFocusEl.focus();
    lastFocusEl = null;
  }

  // Подстановка контактов в модалку и футер
  (function applyContacts(c) {
    const telHref = 'tel:' + c.phone.replace(/[^\d+]/g, '');
    $('.call-btn, .site-footer a[href^="tel:"]').attr('href', telHref).text(`📞 ${c.phone}`);
    $('.mail-btn, .site-footer a[href^="mailto:"]').attr('href', `mailto:${c.email}`).text(`✉️ ${c.email}`);
  })(CONTACTS);

  // Плавный скролл к таблице
  function smoothScrollIntoView($el) {
    const el = $el.get(0);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.top <= window.innerHeight * 0.6;
    if (!inView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Если нужно вернуть карточки при закрытии таблицы, например, в обработчике закрытия каталога:
  function hideTableAndShowCards() {
    $('#table-wrap').addClass('hidden');
    $('#note').addClass('hidden');
    $('#cards-wrap').removeClass('hidden');
  }

})();

