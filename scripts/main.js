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

  // Блокируем кнопки до загрузки JSON
  $btnSearch.prop('disabled', true);
  $btnAll.prop('disabled', true);

  // Загружаем JSON в общий DATA
  $.getJSON('data/parts.json')
    .done(function(json) {
      DATA = json;

      // 🔍 Быстрая проверка
      try {
        if (!Array.isArray(DATA)) throw new Error('Данные не являются массивом');
        if (!DATA.length) throw new Error('Массив пуст');
        DATA.forEach(function(item, i) {
          if (!item.code || !item.name || !item.photo) {
            throw new Error(`Нет обязательного поля в элементе №${i + 1}`);
          }
        });
        console.log(`✅ Загружено ${DATA.length} записей — формат корректен`);
      } catch (e) {
        console.error(`❌ Проблема с JSON: ${e.message}`);
      }

      // Разблокируем кнопки и поля
      $btnSearch.prop('disabled', false);
      $btnAll.prop('disabled', false);
      $input.prop('disabled', false);
    })
    .fail(function(jqxhr, textStatus, error) {
      console.error('Ошибка загрузки parts.json:', textStatus, error);
    });

  // Заглушка (можешь оставить как есть)
  const PLACEHOLDER_SRC =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480'%3E%3Crect width='100%25' height='100%25' fill='%23eeeeee'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999999' font-family='Verdana' font-size='26'%3E%D0%9D%D0%95%D0%A2%20%D0%A4%D0%9E%D0%A2%D0%9E%3C/text%3E%3C/svg%3E";
  
  // Инициализация DataTable
  const dt = $('#parts-table').DataTable({
    data: [],
    columns: [
      { data: 'code', title: 'Код' },
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
          img.src = safeSrc;
          img.alt = `Фото ${escapeHtml(row.code)}`;
  
          img.onerror = function () {
            this.onerror = null;
            this.src = PLACEHOLDER_SRC;
          };
  
          return img.outerHTML;
        }
      },
      { data: 'name', title: 'Наименование' }
    ],
    pageLength: 25,
    lengthMenu: [ [10, 20, 50, -1], [10, 20, 50, 'Все'] ],
    order: [[0, 'asc']],
    autoWidth: false,
    language: {
      emptyTable: 'Нет данных',
      info: 'Показаны записи: _START_-_END_ из _TOTAL_',
      infoEmpty: '0 записей',
      paginate: { previous: 'Назад', next: 'Вперёд' }
    },
    dom: 'tip'
  });

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function showRows(rows) {
    dt.clear();
    dt.rows.add(rows);
    dt.draw();
    $tableWrap.removeClass('hidden');
    $note.removeClass('hidden');
    smoothScrollIntoView($tableWrap);
  }

  function filterData(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return DATA.filter(item => {
      const code = item.code.toLowerCase();
      const name = item.name.toLowerCase();
      return code.startsWith(q) || name.includes(q);
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
  });

  $btnSearch.on('click', function () { doSearch({ openIfSingle: false }); });
  $input.on('keydown', function (e) {
    if (e.key === 'Enter') doSearch({ openIfSingle: false });
  });

  function doSearch(opts = {}) {
    const { query, openIfSingle = true, exact = false } = opts;
    const val = (query !== undefined ? String(query) : $input.val()).trim();
    $suggestions.addClass('hidden').empty();
    if (!val) {
      $tableWrap.addClass('hidden');
      $note.addClass('hidden');
      return;
    }
    let rows;
    if (exact) {
      const q = val.toLowerCase();
      rows = DATA.filter(it =>
        it.code.toLowerCase() === q || it.name.toLowerCase() === q
      );
    } else {
      rows = filterData(val);
    }
    showRows(rows);
    if (openIfSingle && rows.length === 1) {
      openModal(rows[0].photo || PLACEHOLDER_SRC);
    }
  }

  $btnAll.on('click', function () {
    if (isAnimating) return;
  
    const durationMs = 400; // должна совпадать с transition в CSS
    const el = $results[0];
  
    // Всегда приводим контент в актуальное состояние перед измерением
    if (!isCatalogOpen) {
      // Открываем: подготовка контента
      $input.val('');
      $clearBtn.hide();
      $suggestions.addClass('hidden').empty();
  
      // Заполняем таблицу (важно сделать ДО измерения высоты)
      showRows(DATA);
  
      // Снимаем скрытие с контента
      $tableWrap.removeClass('hidden');
      $note.removeClass('hidden');
  
      // Начинаем анимацию
      isAnimating = true;
      // Старт из 0
      $results.css('height', '0').addClass('open');
  
      // Следующий кадр — до полной высоты
      requestAnimationFrame(() => {
        const full = el.scrollHeight;
        $results.css('height', full + 'px');
      });
  
      // По завершении анимации фиксируем auto и завершаем цикл
      $results.one('transitionend', () => {
        $results.css('height', 'auto');
        isAnimating = false;
        isCatalogOpen = true;
      });
  
    } else {
      // Закрываем
      isAnimating = true;
  
      // Фиксируем текущую фактическую высоту (если была auto)
      const current = el.getBoundingClientRect().height;
      $results.css('height', current + 'px');
  
      // Следующий кадр — схлопываем до 0
      requestAnimationFrame(() => {
        $results.css('height', '0').removeClass('open');
      });
  
      $results.one('transitionend', () => {
        // Прячем содержимое ТОЛЬКО после схлопывания
        $tableWrap.addClass('hidden');
        $note.addClass('hidden');
  
        // Ничего не удаляем из DOM! (НЕ делаем $results.empty())
        // Если нужно очистить строки таблицы — чистим DataTable:
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








})();

