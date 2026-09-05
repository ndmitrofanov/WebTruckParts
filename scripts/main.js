// Простая автономная логика рендера карточек и модалки
(function () {
  // main.js запущен — минимальные логи
  console.log('[main.js] initialized');
  // Абсолютный путь надёжнее при разном базовом URL
  const DATA_URL = '/data/parts.json';
  const cardsWrap = document.getElementById('cards-wrap');
  const tableWrap = document.getElementById('table-wrap');
  const showAllBtn = document.getElementById('show-all');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const clearBtn = document.getElementById('clear-search');
  const modal = document.getElementById('modal');
  const modalImg = document.getElementById('modal-img');

  let showTable = false;
  let cards = [];
  let parts = [];
  let currentData = [];

  // если контейнер для карточек отсутствует — создаём и вставляем в конец <body>
  if (!cardsWrap) {
    cardsWrap = document.createElement('div');
    cardsWrap.id = 'cards-wrap';
    cardsWrap.className = 'cards-wrap';
    document.body.appendChild(cardsWrap);
  }

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function loadData() {
    console.log('[main.js] loadData start, fetching', DATA_URL);
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      console.log('[main.js] fetch done, status', res.status);
      if (!res.ok) throw new Error('Ошибка загрузки данных: ' + res.status);
      const json = await res.json();
      cards = Array.isArray(json.cards) ? json.cards : [];
      parts = Array.isArray(json.parts) ? json.parts : [];
      currentData = cards;
      console.log('[main.js] json parsed, cards:', cards.length, 'parts:', parts.length);
      renderCards(currentData);
      cardsWrap.classList.remove('hidden');
      tableWrap.classList.add('hidden');
    } catch (err) {
      console.error('[main.js] loadData error', err);
      cardsWrap.innerHTML = '<p class="purchase-note">Не удалось загрузить карточки.</p>';
    }
  }

  // Рендер карточек
  function renderCards(data) {
    console.log('[main.js] renderCards called, data length:', data.length);
    if (!cardsWrap) {
      console.warn('[main.js] renderCards: cardsWrap not found');
      return;
    }
    if (!data || data.length === 0) {
      cardsWrap.innerHTML = '<p class="purchase-note">Карточек пока нет.</p>';
      console.warn('[main.js] renderCards: empty data');
      return;
    }

    cardsWrap.innerHTML = data.map(c => {
      const photo = c.photo || 'images/placeholder.png';
      const code = escapeHtml(c.code || '');
      const name = escapeHtml(c.name || '');
      const desc = escapeHtml(c.desc || '');
      return `
        <article class="card" data-code="${code}">
          <img class="card-img" src="${photo}" alt="${name}" style="cursor: zoom-in;">
          <div class="card-code">${code}</div>
          <div class="card-title">${name}</div>
          <div class="card-desc">${desc}</div>
        </article>
      `;
    }).join('');

    cardsWrap.querySelectorAll('.card-img').forEach(img => {
      img.addEventListener('click', () => openModal(img.getAttribute('src') || ''));
    });
    cardsWrap.classList.remove('hidden');
    cardsWrap.style.display = 'grid'; // Явно показываем как grid (ваш стиль)
    tableWrap.classList.add('hidden');
    tableWrap.classList.remove('open');
    tableWrap.style.display = 'none'; // Полностью скрываем таблицу
    console.log('[main.js] renderCards: rendered', data.length, 'cards');
  }

  // Рендер таблицы (теперь принимает data)
  function renderTable(data) {
    console.log('[main.js] renderTable called, data length:', data.length);
    if (!tableWrap) {
      console.warn('[main.js] renderTable: tableWrap not found');
      return;
    }
    // Удаляем старую таблицу DataTables, если она есть
    if ($.fn.DataTable && $.fn.DataTable.isDataTable('#parts-table')) {
      $('#parts-table').DataTable().destroy();
      $('#parts-table').remove();
    }
    // Очищаем контейнер
    tableWrap.innerHTML = '';

    if (!data || data.length === 0) {
      tableWrap.innerHTML = '<p class="purchase-note">Деталей пока нет.</p>';
      return;
    }

    let html = `
      <table id="parts-table">
        <thead>
          <tr>
            <th>Фото</th>
            <th>Код</th>
            <th>Название</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(p => `
            <tr>
              <td><img class="table-img" src="${escapeHtml(p.photo || 'images/placeholder.png')}" alt="${escapeHtml(p.name || '')}" style="max-width:60px;max-height:60px; cursor: zoom-in;"></td>
              <td>${escapeHtml(p.code || '-')}</td>
              <td>${escapeHtml(p.name || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    tableWrap.innerHTML = html + `<div class="table-total"></div>`;
    cardsWrap.classList.add('hidden');
    cardsWrap.style.display = 'none'; // Полностью скрываем карточки
    tableWrap.classList.remove('hidden');
    tableWrap.classList.add('open');
    tableWrap.style.display = 'block';

    // Дай браузеру отрисовать DOM (важно!)
    setTimeout(() => {
      if (window.$ && $.fn.DataTable) {
        const dt = $('#parts-table').DataTable({
          pageLength: 25,
          autoWidth: false,
          responsive: true,
          destroy: true,
          columnDefs: [
            { targets: 0, orderable: false }
          ],
          language: {
            lengthMenu: 'Показывать _MENU_ позиций на странице',
            zeroRecords: 'Ничего не найдено',
            info: 'Страница _PAGE_ из _PAGES_',
            infoEmpty: 'Нет позиций',
            infoFiltered: '(отфильтровано из _MAX_ позиций)',
            search: 'Поиск:',
            paginate: {
              first: 'Первая',
              last: 'Последняя',
              next: 'Следующая',
              previous: 'Предыдущая'
            }
          }
        });
        // Добавляем "Итого: X записей" справа
        const total = data.length;
        const lengthBlock = tableWrap.querySelector('.dataTables_length');
        if (lengthBlock && !lengthBlock.querySelector('.table-total-inline')) {
          const totalDiv = document.createElement('div');
          totalDiv.className = 'table-total-inline';
          totalDiv.textContent = `Найдено позиций: ${total}`;
          lengthBlock.style.display = 'flex';
          lengthBlock.style.justifyContent = 'space-between';
          lengthBlock.appendChild(totalDiv);
        }
        console.log('[main.js] DataTables initialized');
      }
      // Добавляем слушатели на изображения в таблице
      tableWrap.querySelectorAll('.table-img').forEach(img => {
        img.addEventListener('click', () => openModal(img.getAttribute('src') || ''));
      });
    }, 0);
  }

  let lastFocusEl;
  function openModal(src) {
    lastFocusEl = document.activeElement;
    modalImg.src = src || 'images/placeholder.png';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');

    // Скрываем контактные кнопки (как в исходном коде)
    document.querySelectorAll('.contact-actions').forEach(el => el.classList.add('hidden'));

    // Скрываем футер(ы) при открытой модалке
    document.querySelectorAll('.site-footer').forEach(f => {
      try {
        if (!f.dataset.__prevDisplay) f.dataset.__prevDisplay = f.style.display || '';
        f.style.display = 'none';
      } catch (e) { /* ignore */ }
    });
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    modalImg.src = '';
    document.body.classList.remove('no-scroll');

    // Показываем контактные кнопки обратно
    document.querySelectorAll('.contact-actions').forEach(el => el.classList.remove('hidden'));

    // Восстанавливаем футер(ы)
    document.querySelectorAll('.site-footer').forEach(f => {
      try {
        const prev = f.dataset.__prevDisplay !== undefined ? f.dataset.__prevDisplay : '';
        f.style.display = prev;
        delete f.dataset.__prevDisplay;
      } catch (e) { /* ignore */ }
    });

    if (lastFocusEl && document.contains(lastFocusEl)) lastFocusEl.focus();
    lastFocusEl = null;
  }

  // Закрывать при клике по фону модалки или по крестику
  if (modal) {
    modal.addEventListener('click', function (e) {
      const t = e.target;
      if (t.matches && t.matches('.modal .close')) return closeModal();
      if (t === modal) return closeModal();
      if (t !== modalImg && !t.closest('.contact-actions')) return closeModal();
    });
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // Фильтрация по поисковому запросу
  function filterCards(query) {
    console.log('[main.js] filterCards called, query:', query);
    query = (query || '').trim().toLowerCase();
    // Всегда фильтруем по parts и показываем таблицу
    if (!showTable) {
      showTable = true;
      currentData = parts;
      showAllBtn.textContent = 'Назад к карточкам';
    }
    let filtered = parts;
    if (query) {
      filtered = parts.filter(c =>
        (c.code && c.code.toLowerCase().includes(query)) ||
        (c.name && c.name.toLowerCase().includes(query)) ||
        (c.desc && c.desc.toLowerCase().includes(query))
      );
      console.log('[main.js] filterCards: filtered count', filtered.length);
    } else {
      console.log('[main.js] filterCards: empty query, show all parts');
    }
    renderTable(filtered);
  }

  // Обработчики событий
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => filterCards(searchInput.value));
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') filterCards(searchInput.value);
    });
    // Динамическое показ/скрытие кнопки очистки
    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'block' : 'none';
      renderSuggestions(searchInput.value); // Обновляем подсказки
    });
    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        const suggestionsBox = document.getElementById('suggestions');
        if (suggestionsBox) suggestionsBox.classList.add('hidden');
      }, 200); // задержка, чтобы успел сработать клик по подсказке
    });
  }
  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      filterCards('');
    });
  }
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      showTable = !showTable;
      if (showTable) {
        currentData = parts;
        renderTable(currentData);
        showAllBtn.textContent = 'Назад к карточкам';
      } else {
        currentData = cards;
        renderCards(currentData);
        showAllBtn.textContent = 'Весь каталог';
        // Сброс поиска при возврате к карточкам
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
      }
    });
  }

  // Добавляем стили для предотвращения наложения
  cardsWrap.style.position = 'relative';
  cardsWrap.style.zIndex = '1';
  tableWrap.style.marginTop = '20px'; // Отступ, чтобы не прилипала к топ-бару

  // старт загрузки: если DOM уже готов — запускаем сразу, иначе ждём событие
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadData);
  } else {
    loadData();
  }

  // Функция для рендера подсказок
  function renderSuggestions(query) {
    const suggestionsBox = document.getElementById('suggestions');
    if (!suggestionsBox) return;
    query = (query || '').trim().toLowerCase();
    if (!query) {
      suggestionsBox.classList.add('hidden');
      suggestionsBox.innerHTML = '';
      return;
    }
    // Фильтруем только по parts
    const filtered = parts.filter(p =>
      (p.code && p.code.toLowerCase().includes(query)) ||
      (p.name && p.name.toLowerCase().includes(query))
    ).slice(0, 10); // максимум 10 подсказок

    if (filtered.length === 0) {
      suggestionsBox.classList.add('hidden');
      suggestionsBox.innerHTML = '';
      return;
    }

    suggestionsBox.innerHTML = filtered.map(p => `
      <div class="suggestion-item" tabindex="0" data-code="${p.code}">
        <span class="suggestion-code">${escapeHtml(p.code || '')}</span>
        <span class="suggestion-name">${escapeHtml(p.name || '')}</span>
      </div>
    `).join('');
    suggestionsBox.classList.remove('hidden');

    // Клик по подсказке — подставить в поиск и выполнить поиск
    suggestionsBox.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        searchInput.value = item.dataset.code;
        suggestionsBox.classList.add('hidden');
        filterCards(item.dataset.code);
      });
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          searchInput.value = item.dataset.code;
          suggestionsBox.classList.add('hidden');
          filterCards(item.dataset.code);
        }
      });
    });
  }
})();