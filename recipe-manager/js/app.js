/**
 * 菜谱管理系统 - 主应用逻辑
 */
const PRESET_TAGS = {
  cuisine: ['中餐', '西餐', '日韩料理', '东南亚菜', '中东菜', '其他'],
  type: ['主食类', '主菜类', '配菜类', '汤羹类', '点心甜品类', '饮品类', '酱料蘸料类'],
  difficulty: ['新手友好级', '家庭厨师级', '专业挑战级']
};

const App = {
  recipes: [],
  favorites: new Set(),
  categories: null,
  currentFilters: { search: '', cuisine: [], type: [], ingredient: [], difficulty: [], customTags: [] },

  async init() {
    await initDB();
    await this.loadData();
    this.setupNavigation();
    this.renderHome();
    this.bindEvents();
  },

  async loadData() {
    this.recipes = await getAllRecipes();
    if (this.recipes.length === 0) {
      await this.seedSampleRecipes();
    }
    const favs = await getFavorites();
    this.favorites = new Set(favs.map(f => f.recipeId));
    this.categories = await getCategories();
  },

  async seedSampleRecipes() {
    const samples = [
      { name: '番茄炒蛋', description: '家常快手菜，营养美味', ingredients: [{ name: '番茄', amount: '2个' }, { name: '鸡蛋', amount: '3个' }, { name: '盐', amount: '适量' }], steps: [{ text: '番茄洗净切块' }, { text: '鸡蛋打散加少许盐' }, { text: '热锅下油炒鸡蛋' }, { text: '加入番茄翻炒' }], prepTime: 10, cookTime: 5, difficulty: '新手友好级', tags: { cuisine: ['中餐'], type: ['主菜类'], ingredient: ['番茄', '鸡蛋'], custom: ['快手菜'] } },
      { name: '红烧肉', description: '肥而不腻，入口即化', ingredients: [{ name: '五花肉', amount: '500g' }, { name: '冰糖', amount: '30g' }, { name: '生抽', amount: '2勺' }], steps: [{ text: '五花肉切块焯水' }, { text: '冰糖炒糖色' }, { text: '加入五花肉翻炒' }, { text: '小火炖煮1小时' }], prepTime: 20, cookTime: 60, difficulty: '家庭厨师级', tags: { cuisine: ['中餐'], type: ['主菜类'], ingredient: ['猪肉'], custom: ['下饭菜'] } }
    ];
    for (const r of samples) await saveRecipe(r);
    this.recipes = await getAllRecipes();
  },

  setupNavigation() {
    const parseHash = () => {
      const hash = location.hash.slice(1) || 'home';
      const [page, id] = hash.split('/');
      this.navigate(page || 'home', id ? { id } : {});
    };
    parseHash();
    window.addEventListener('hashchange', parseHash);
  },

  navigate(page, params = {}) {
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`${page}-page`);
    if (target) target.classList.add('active');

    const navPage = ['recipe-detail', 'edit-recipe'].includes(page) ? 'recipes' : page;
    document.querySelectorAll('.nav-link[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === navPage);
    });

    switch (page) {
      case 'home': this.renderHome(); break;
      case 'recipes': this.renderRecipes(); break;
      case 'lottery': this.renderLottery(); break;
      case 'profile': this.renderProfile(); break;
      case 'recipe-detail': this.renderRecipeDetail(params.id); break;
      case 'edit-recipe': this.renderEditRecipe(params.id); break;
    }
  },

  bindEvents() {
    document.getElementById('global-search')?.addEventListener('input', e => {
      this.currentFilters.search = e.target.value.trim();
      if (document.getElementById('recipes-page')?.classList.contains('active')) {
        this.renderRecipes();
      }
    });
    document.getElementById('global-search')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.performSearch();
    });
    document.querySelector('.search-box-wrapper .search-icon')?.addEventListener('click', () => {
      this.performSearch();
    });
  },

  performSearch() {
    const input = document.getElementById('global-search');
    if (input) this.currentFilters.search = input.value.trim();
    this.navigate('recipes');
  },

  getFilteredRecipes() {
    let result = [...this.recipes];
    const { search, cuisine, type, ingredient, difficulty, customTags } = this.currentFilters;

    if (search) {
      const s = search.toLowerCase();
      const matchTag = t => (t || '').toLowerCase().includes(s);
      result = result.filter(r =>
        r.name.toLowerCase().includes(s) ||
        (r.description || '').toLowerCase().includes(s) ||
        (r.tags?.custom || []).some(matchTag) ||
        (r.tags?.ingredient || []).some(matchTag) ||
        (r.ingredientTags || []).some(matchTag)
      );
    }
    if (cuisine.length) result = result.filter(r => 
      (r.tags?.cuisine || []).some(t => cuisine.includes(t)));
    if (type.length) result = result.filter(r => 
      (r.tags?.type || []).some(t => type.includes(t)));
    if (ingredient.length) result = result.filter(r =>
      (r.tags?.ingredient || []).some(t => ingredient.includes(t)));
    if (difficulty.length) result = result.filter(r => difficulty.includes(r.difficulty));
    if (customTags.length) result = result.filter(r => 
      (r.tags?.custom || []).some(t => customTags.includes(t)));

    return result;
  },

  getUsedTagsFromRecipes() {
    const cuisine = new Set();
    const type = new Set();
    const ingredient = new Set();
    const difficulty = new Set();
    this.recipes.forEach(r => {
      (r.tags?.cuisine || []).forEach(t => cuisine.add(t));
      (r.tags?.type || []).forEach(t => type.add(t));
      (r.tags?.ingredient || []).forEach(t => ingredient.add(t));
      if (r.difficulty) difficulty.add(r.difficulty);
    });
    return {
      cuisine: [...cuisine].sort(),
      type: [...type].sort(),
      ingredient: [...ingredient].sort(),
      difficulty: [...difficulty].sort()
    };
  },

  renderHome() {
    const container = document.getElementById('home-content');
    if (!container) return;

    const total = this.recipes.length;
    const favCount = this.favorites.size;
    const recentCount = this.recipes.filter(r => {
      const d = new Date(r.createdAt || 0);
      return (Date.now() - d) < 7 * 24 * 60 * 60 * 1000;
    }).length;

    container.innerHTML = `
      <div class="hero">
        <h2>欢迎使用菜谱管理系统</h2>
        <p>记录专属菜谱，发现美食乐趣，让每天吃什么不再烦恼！</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-num">${total}</span>
          <span>总菜谱</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">${favCount}</span>
          <span>收藏</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">${recentCount}</span>
          <span>本周新增</span>
        </div>
      </div>
      <div class="quick-actions">
        <a href="#recipes" class="action-card">
          <span class="action-icon">📖</span>
          <h3>菜谱</h3>
          <p>浏览与筛选菜谱</p>
        </a>
        <a href="#lottery" class="action-card">
          <span class="action-icon">🎲</span>
          <h3>抽签</h3>
          <p>智能抽签选菜</p>
        </a>
        <a href="#profile" class="action-card">
          <span class="action-icon">👤</span>
          <h3>用户主页</h3>
          <p>收藏与每周菜单</p>
        </a>
      </div>
    `;
  },

  renderRecipes() {
    const container = document.getElementById('recipes-content');
    const filterContainer = document.getElementById('recipes-filters');
    if (!container) return;

    const usedTags = this.getUsedTagsFromRecipes();
    const cats = {
      cuisine: usedTags.cuisine,
      type: usedTags.type,
      difficulty: usedTags.difficulty
    };

    if (filterContainer) {
      filterContainer.innerHTML = `
        <div class="filter-section">
          <span class="filter-label">菜系:</span>
          <div class="tag-group">${(cats.cuisine || []).map(t => 
            `<span class="filter-tag" data-type="cuisine" data-value="${t}">${t}</span>`
          ).join('')}</div>
        </div>
        <div class="filter-section">
          <span class="filter-label">类型:</span>
          <div class="tag-group">${(cats.type || []).map(t => 
            `<span class="filter-tag" data-type="type" data-value="${t}">${t}</span>`
          ).join('')}</div>
        </div>
        <div class="filter-section">
          <span class="filter-label">难度:</span>
          <div class="tag-group">${(cats.difficulty || []).map(t => 
            `<span class="filter-tag" data-type="difficulty" data-value="${t}">${t}</span>`
          ).join('')}</div>
        </div>
      `;

      filterContainer.querySelectorAll('.filter-tag').forEach(el => {
        el.addEventListener('click', () => {
          el.classList.toggle('active');
          const type = el.dataset.type, value = el.dataset.value;
          const arr = this.currentFilters[type] || [];
          const idx = arr.indexOf(value);
          if (idx >= 0) arr.splice(idx, 1);
          else arr.push(value);
          this.currentFilters[type] = arr;
          this.renderRecipes();
        });
        if ((this.currentFilters[el.dataset.type] || []).includes(el.dataset.value)) {
          el.classList.add('active');
        }
      });
    }

    const list = this.getFilteredRecipes();
    container.innerHTML = list.length ? list.map(r => this.recipeCardHTML(r)).join('') 
      : '<p class="empty-msg">暂无匹配的菜谱</p>';

    container.querySelectorAll('.recipe-card-link').forEach(card => {
      card.addEventListener('click', e => {
        if (!e.target.closest('.btn')) {
          this.navigate('recipe-detail', { id: card.dataset.id });
        }
      });
    });
  },

  recipeCardHTML(recipe) {
    const cover = recipe.coverImage 
      ? `url(${recipe.coverImage})` 
      : 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)';
    const tags = [
      ...(recipe.difficulty ? [recipe.difficulty] : []),
      ...(recipe.tags?.cuisine || []),
      ...(recipe.tags?.type || []),
      ...(recipe.tags?.ingredient || []).slice(0, 2),
      ...(recipe.tags?.custom || []).slice(0, 2)
    ].slice(0, 5);

    return `
      <a href="#recipe-detail/${recipe.id}" class="recipe-card-link" data-id="${recipe.id}">
        <div class="recipe-card">
          <div class="recipe-cover" style="background-image: ${cover}">
            ${!recipe.coverImage ? '<span class="recipe-emoji">' + this.getEmoji(recipe) + '</span>' : ''}
          </div>
          <div class="recipe-info">
            <h3>${recipe.name}</h3>
            <div class="recipe-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
          </div>
        </div>
      </a>
    `;
  },

  getEmoji(recipe) {
    const name = recipe.name || '';
    const map = { '肉': '🥩', '鸡': '🍗', '鱼': '🐟', '虾': '🦐', '蛋': '🥚', '面': '🍜', '饭': '🍚', '汤': '🍲', '菜': '🥬', '甜': '🍰' };
    for (const [k, v] of Object.entries(map)) if (name.includes(k)) return v;
    return '🍳';
  },

  renderLottery() {
    const container = document.getElementById('lottery-content');
    if (!container) return;

    container.innerHTML = `
      <div class="lottery-header">
        <h2>🎲 智能抽签</h2>
        <p>根据现有食材推荐、随机选择，或设置过滤条件</p>
      </div>
      <div class="lottery-filters">
        <div class="filter-row">
          <label>可用食材（逗号分隔）:</label>
          <input type="text" id="lottery-ingredients" class="form-input" placeholder="如：番茄,鸡蛋,葱">
        </div>
        <div class="filter-row">
          <label>最大时间(分钟):</label>
          <input type="number" id="lottery-maxtime" class="form-input" placeholder="不限" min="0">
        </div>
        <div class="filter-row">
          <label>难度:</label>
          <select id="lottery-difficulty" class="form-input">
            <option value="">不限</option>
            <option value="简单">简单</option>
            <option value="中等">中等</option>
            <option value="困难">困难</option>
          </select>
        </div>
        <div class="filter-row">
          <label>类型:</label>
          <select id="lottery-type" class="form-input">
            <option value="">不限</option>
            ${(this.getUsedTagsFromRecipes().type || []).map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="roulette-area">
        <div class="roulette-container" id="roulette-container">
          <div class="roulette-wheel" id="roulette-wheel"></div>
          <div class="roulette-pointer">▼</div>
        </div>
        <button class="btn btn-primary spin-btn" id="lottery-spin">🎯 开始抽签</button>
      </div>
      <div class="lottery-result" id="lottery-result"></div>
    `;

    this.setupLottery();
  },

  setupLottery() {
    const spinBtn = document.getElementById('lottery-spin');
    const resultEl = document.getElementById('lottery-result');
    const wheelEl = document.getElementById('roulette-wheel');

    spinBtn?.addEventListener('click', async () => {
      const ingredientsInput = document.getElementById('lottery-ingredients')?.value?.trim() || '';
      const availableIngredients = ingredientsInput ? ingredientsInput.split(/[,，]/).map(s => s.trim()) : [];
      const maxTime = parseInt(document.getElementById('lottery-maxtime')?.value) || 0;
      const difficulty = document.getElementById('lottery-difficulty')?.value || '';
      const type = document.getElementById('lottery-type')?.value || '';

      let candidates = [...this.recipes];
      if (availableIngredients.length) {
        const allIngTags = r => [...(r.tags?.ingredient || []), ...(r.ingredientTags || [])];
        candidates = candidates.filter(r =>
          allIngTags(r).some(tag =>
            availableIngredients.some(ing => tag.toLowerCase().includes(ing.toLowerCase()) || ing.toLowerCase().includes(tag.toLowerCase()))
          )
        );
      }
      if (maxTime) candidates = candidates.filter(r => (r.prepTime || 0) + (r.cookTime || 0) <= maxTime);
      if (difficulty) candidates = candidates.filter(r => r.difficulty === difficulty);
      if (type) candidates = candidates.filter(r => (r.tags?.type || []).includes(type));

      if (candidates.length === 0) {
        resultEl.innerHTML = '<p class="empty-msg">没有符合条件的菜谱</p>';
        return;
      }

      // 轮盘动画
      const items = candidates.slice(0, 8);
      wheelEl.innerHTML = items.map((r, i) => 
        `<div class="roulette-item" data-id="${r.id}">${r.name}</div>`
      ).join('');

      const duration = 3000;
      const spins = 5 + Math.random() * 3;
      const finalIndex = Math.floor(Math.random() * items.length);
      const degPerItem = 360 / items.length;
      const offset = degPerItem * finalIndex + degPerItem / 2;
      const targetDeg = 360 * spins + offset;

      wheelEl.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      wheelEl.style.transform = `rotate(${targetDeg}deg)`;

      spinBtn.disabled = true;
      setTimeout(() => {
        spinBtn.disabled = false;
        const winner = items[finalIndex];
        resultEl.innerHTML = `
          <div class="result-card">
            <h3>🎉 抽中：${winner.name}</h3>
            <a href="#recipe-detail/${winner.id}" class="btn btn-primary">查看菜谱</a>
          </div>
        `;
      }, duration);
    });
  },

  renderProfile() {
    const container = document.getElementById('profile-content');
    if (!container) return;

    const favIds = [...this.favorites];
    const favRecipes = this.recipes.filter(r => favIds.includes(r.id));

    container.innerHTML = `
      <div class="profile-section">
        <h2>⭐ 收藏夹</h2>
        <div class="recipes-grid" id="profile-favorites">
          ${favRecipes.length ? favRecipes.map(r => this.recipeCardHTML(r)).join('') : '<p class="empty-msg">暂无收藏</p>'}
        </div>
      </div>
      <div class="profile-section">
        <h2>📅 每周菜单规划</h2>
        <div class="weekly-menu" id="weekly-menu"></div>
      </div>
    `;

    this.renderWeeklyMenu();
    container.querySelectorAll('.recipe-card-link').forEach(card => {
      card.addEventListener('click', e => {
        if (!e.target.closest('.btn')) this.navigate('recipe-detail', { id: card.dataset.id });
      });
    });
  },

  async renderWeeklyMenu() {
    const year = new Date().getFullYear();
    const weekNum = this.getWeekNumber(new Date());
    const weekKey = `${year}-W${weekNum}`;
    const menu = await getWeeklyMenu(weekKey);
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const container = document.getElementById('weekly-menu');
    if (!container) return;

    container.innerHTML = `
      <div class="week-header">${year}年第${weekNum}周</div>
      <div class="week-days">
        ${days.map((d, i) => {
          const dayKey = `day${i}`;
          const assign = menu.days?.[dayKey] || null;
          const recipe = assign ? this.recipes.find(r => r.id === assign) : null;
          return `
            <div class="day-slot" data-day="${dayKey}">
              <span class="day-name">${d}</span>
              <div class="day-recipe" data-recipe-id="${assign || ''}">
                ${recipe ? `<a href="#recipe-detail/${recipe.id}">${recipe.name}</a>` : '<span class="assign-btn">+ 分配</span>'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.day-slot').forEach(slot => {
      slot.addEventListener('click', () => this.showAssignModal(weekKey, slot.dataset.day, menu));
    });
  },

  getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  showAssignModal(weekKey, dayKey, menu) {
    const list = this.getFilteredRecipes();
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const dayLabel = days[parseInt(dayKey.replace('day', ''))] || dayKey;
    const html = list.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>分配菜谱 - ${dayLabel}</h3>
        <select id="assign-select" class="form-input">${html}</select>
        <div class="modal-actions">
          <button class="btn btn-primary" id="assign-confirm">确定</button>
          <button class="btn btn-secondary" id="assign-cancel">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#assign-cancel').onclick = () => modal.remove();
    modal.querySelector('#assign-confirm').onclick = async () => {
      const recipeId = modal.querySelector('#assign-select').value;
      menu.days = menu.days || {};
      menu.days[dayKey] = recipeId;
      menu.weekKey = weekKey;
      await saveWeeklyMenu(menu);
      modal.remove();
      this.renderProfile();
    };
  },

  async renderRecipeDetail(id) {
    const recipe = await getRecipe(id);
    const container = document.getElementById('recipe-detail-content');
    if (!container || !recipe) return;

    const isFav = this.favorites.has(recipe.id);
    const ingredients = recipe.ingredients || [];
    const ingList = Array.isArray(ingredients) 
      ? ingredients 
      : ingredients.split('\n').map(line => {
          const [name, amount] = line.split(/\s+/);
          return { name: name || line, amount: amount || '' };
        });
    const steps = recipe.steps || [];
    const stepList = Array.isArray(steps) 
      ? steps 
      : (typeof steps === 'string' ? steps.split('\n') : []).map((s, i) => ({ text: s, image: null }));

    const allTags = [
      ...(recipe.difficulty ? [recipe.difficulty] : []),
      ...(recipe.tags?.cuisine || []),
      ...(recipe.tags?.type || []),
      ...(recipe.tags?.ingredient || []),
      ...(recipe.tags?.custom || [])
    ];

    container.innerHTML = `
      <div class="detail-header">
        <button class="btn btn-secondary back-btn" onclick="App.navigate('recipes')">← 返回</button>
        <div class="detail-actions">
          <button class="btn ${isFav ? 'btn-fav active' : 'btn-fav'}" id="fav-btn">${isFav ? '❤️' : '🤍'} 收藏</button>
          <a href="#edit-recipe/${recipe.id}" class="btn btn-primary">✏️ 编辑</a>
          <button class="btn btn-danger" id="delete-recipe-btn">🗑️ 删除</button>
        </div>
      </div>
      <div class="detail-cover" style="background-image: url(${recipe.coverImage || ''})">
        ${!recipe.coverImage ? '<span class="detail-emoji">' + this.getEmoji(recipe) + '</span>' : ''}
      </div>
      <h1 class="detail-title">${recipe.name}</h1>
      ${recipe.description ? `<p class="detail-desc">${recipe.description}</p>` : ''}
      <div class="detail-meta">
        <span>⏱️ 准备 ${recipe.prepTime || 0}分钟</span>
        <span>🍳 烹饪 ${recipe.cookTime || 0}分钟</span>
        ${allTags.length ? `<span class="detail-tags">🏷️ ${allTags.join(' · ')}</span>` : ''}
      </div>
      <section class="detail-section">
        <h3>🥬 食材清单</h3>
        <ul class="ingredient-list">
          ${ingList.map(i => `
            <li>
              ${i.image ? `<img src="${i.image}" alt="" class="ingredient-img">` : ''}
              <span>${typeof i === 'string' ? i : (i.name + ' ' + (i.amount || ''))}</span>
            </li>
          `).join('')}
        </ul>
      </section>
      <section class="detail-section">
        <h3>📝 步骤说明</h3>
        <div class="steps-list">
          ${stepList.map((s, i) => `
            <div class="step-item">
              <span class="step-num">${i + 1}</span>
              <div class="step-content">
                <p>${typeof s === 'string' ? s : s.text}</p>
                ${(s.image || (s.stepImage)) ? `<img src="${s.image || s.stepImage}" alt="步骤${i+1}" class="step-img">` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
      ${recipe.videoUrl ? `
        <section class="detail-section">
          <h3>🎬 视频教程</h3>
          <a href="${recipe.videoUrl}" target="_blank" rel="noopener" class="video-link">观看视频 →</a>
        </section>
      ` : ''}
    `;

    document.getElementById('fav-btn')?.addEventListener('click', async () => {
      await toggleFavorite(recipe.id);
      await this.loadData();
      this.renderRecipeDetail(id);
    });

    document.getElementById('delete-recipe-btn')?.addEventListener('click', async () => {
      if (confirm('确定要删除这道菜谱吗？')) {
        await deleteRecipe(recipe.id);
        this.navigate('recipes');
      }
    });
  },

  renderEditRecipe(id) {
    const container = document.getElementById('edit-recipe-content');
    if (!container) return;

    const recipe = id ? this.recipes.find(r => r.id === id) : null;
    const isEdit = !!recipe;

    container.innerHTML = `
      <div class="edit-header">
        <button class="btn btn-secondary back-btn" onclick="App.navigate('recipes')">← 返回</button>
        <h2>${isEdit ? '编辑菜谱' : '添加菜谱'}</h2>
      </div>
      <form id="recipe-form" class="recipe-form">
        <input type="hidden" id="recipe-id" value="${recipe?.id || ''}">
        <div class="form-group">
          <label>菜谱名称 *</label>
          <input type="text" id="recipe-name" required value="${recipe?.name || ''}">
        </div>
        <div class="form-group">
          <label>菜描述</label>
          <textarea id="recipe-desc">${recipe?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label>成品图 (支持 PNG、JPG 上传或粘贴 URL)</label>
          <input type="text" id="recipe-cover" placeholder="图片URL或上传PNG/JPG后自动填入" value="${recipe?.coverImage || ''}">
          <input type="file" id="recipe-cover-file" accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg" style="margin-top:8px">
        </div>
        <div class="form-group">
          <label>食材清单 * (每行: 食材名 用量，可后续扩展为带图)</label>
          <textarea id="recipe-ingredients" required placeholder="番茄 2个\n鸡蛋 3个\n盐 适量">${Array.isArray(recipe?.ingredients) 
            ? recipe.ingredients.map(i => (i.name || i) + ' ' + (i.amount || '')).join('\n') 
            : (recipe?.ingredients || '')}</textarea>
        </div>
        <div class="form-group">
          <label>步骤说明 * (每步可添加文字和图片)</label>
          <div id="steps-container" class="steps-editor"></div>
          <button type="button" class="btn btn-secondary btn-sm" id="add-step-btn">+ 添加步骤</button>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>准备时间(分钟)</label>
            <input type="number" id="recipe-prep" min="0" value="${recipe?.prepTime || 0}">
          </div>
          <div class="form-group">
            <label>烹饪时间(分钟)</label>
            <input type="number" id="recipe-cook" min="0" value="${recipe?.cookTime || 0}">
          </div>
        </div>
        <div class="form-group">
          <label>难度</label>
          <div class="tag-select tag-select-single" id="recipe-difficulty-select">
            ${PRESET_TAGS.difficulty.map(t => {
              const sel = recipe?.difficulty === t || (!recipe?.difficulty && t === '新手友好级');
              return `<span class="select-tag${sel ? ' selected' : ''}" data-value="${t}">${t}</span>`;
            }).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>菜系</label>
          <div class="tag-select" id="recipe-cuisine-select">
            ${PRESET_TAGS.cuisine.map(t => {
              const sel = (recipe?.tags?.cuisine || []).includes(t);
              return `<span class="select-tag${sel ? ' selected' : ''}" data-value="${t}">${t}</span>`;
            }).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>类型</label>
          <div class="tag-select" id="recipe-type-select">
            ${PRESET_TAGS.type.map(t => {
              const sel = (recipe?.tags?.type || []).includes(t);
              return `<span class="select-tag${sel ? ' selected' : ''}" data-value="${t}">${t}</span>`;
            }).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>食材标签 (手动输入，逗号分隔，用于搜索匹配)</label>
          <input type="text" id="recipe-ingredient-tags" placeholder="猪肉,番茄,鸡蛋" value="${(recipe?.tags?.ingredient || []).join(',')}">
        </div>
        <div class="form-group">
          <label>自定义标签 (可选)</label>
          <input type="text" id="recipe-custom" placeholder="快手菜,下饭菜" value="${(recipe?.tags?.custom || []).join(',')}">
        </div>
        <div class="form-group">
          <label>视频链接</label>
          <input type="url" id="recipe-video" value="${recipe?.videoUrl || ''}">
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">💾 保存</button>
          <button type="button" class="btn btn-secondary" onclick="App.navigate('recipes')">取消</button>
        </div>
      </form>
    `;

    document.querySelectorAll('#recipe-difficulty-select .select-tag').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#recipe-difficulty-select .select-tag').forEach(t => t.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
    document.querySelectorAll('#recipe-cuisine-select .select-tag').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('selected'));
    });
    document.querySelectorAll('#recipe-type-select .select-tag').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('selected'));
    });

    const stepsData = Array.isArray(recipe?.steps) ? recipe.steps.map(s => ({
      text: typeof s === 'string' ? s : (s.text || ''),
      image: (typeof s === 'object' && (s.image || s.stepImage)) || ''
    })) : ((recipe?.steps || '') ? String(recipe.steps).split('\n').filter(Boolean).map(t => ({
      text: t.replace(/^\d+[.．]\s*/, ''),
      image: ''
    })) : [{ text: '', image: '' }]);

    const renderStepsEditor = () => {
      const container = document.getElementById('steps-container');
      if (!container) return;
      container.querySelectorAll('.step-editor-item').forEach((item, i) => {
        if (stepsData[i]) {
          const ta = item.querySelector('.step-text-input');
          if (ta) stepsData[i].text = ta.value;
        }
      });
      const esc = str => String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      container.innerHTML = stepsData.map((s, i) => `
        <div class="step-editor-item" data-index="${i}">
          <div class="step-editor-header">
            <span class="step-editor-num">步骤 ${i + 1}</span>
            <button type="button" class="btn-remove-step" ${stepsData.length <= 1 ? 'disabled' : ''}>删除</button>
          </div>
          <textarea class="step-text-input" placeholder="描述此步骤...">${(s.text || '').replace(/</g, '&lt;')}</textarea>
          <div class="step-image-row">
            <label class="step-img-label">步骤图 (PNG/JPG):</label>
            <input type="text" class="step-img-url" placeholder="图片URL或上传后自动填入" value="${esc(s.image)}">
            <input type="file" class="step-img-file" accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg" data-index="${i}">
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-remove-step').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.closest('.step-editor-item').dataset.index);
          stepsData.splice(idx, 1);
          renderStepsEditor();
        };
      });
      container.querySelectorAll('.step-img-file').forEach(input => {
        input.onchange = e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const idx = parseInt(input.dataset.index);
            stepsData[idx].image = reader.result;
            renderStepsEditor();
          };
          reader.readAsDataURL(file);
        };
      });
      container.querySelectorAll('.step-img-url').forEach((input, i) => {
        input.oninput = () => { stepsData[i].image = input.value.trim(); };
      });
      container.querySelectorAll('.step-text-input').forEach((input, i) => {
        input.oninput = () => { stepsData[i].text = input.value; };
      });
    };
    renderStepsEditor();

    document.getElementById('add-step-btn')?.addEventListener('click', () => {
      stepsData.push({ text: '', image: '' });
      renderStepsEditor();
    });

    document.getElementById('recipe-cover-file')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        document.getElementById('recipe-cover').value = reader.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('recipe-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const ingText = document.getElementById('recipe-ingredients').value;
      const ingredients = ingText.split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        return { name: parts[0] || '', amount: parts.slice(1).join(' ') || '' };
      }).filter(i => i.name);

      document.getElementById('steps-container')?.querySelectorAll('.step-editor-item').forEach((item, i) => {
        if (stepsData[i]) {
          const ta = item.querySelector('.step-text-input');
          const urlInput = item.querySelector('.step-img-url');
          if (ta) stepsData[i].text = ta.value;
          if (urlInput) stepsData[i].image = urlInput.value.trim();
        }
      });
      const steps = stepsData.filter(s => (s.text || '').trim()).map(s => ({
        text: s.text.trim(),
        image: s.image || null
      }));
      if (steps.length === 0) {
        alert('请至少添加一个步骤');
        return;
      }

      const getSelectedTags = selId => {
        return [...document.querySelectorAll(`#${selId} .select-tag.selected`)].map(el => el.dataset.value);
      };
      const difficultyEl = document.querySelector('#recipe-difficulty-select .select-tag.selected');
      const data = {
        id: document.getElementById('recipe-id').value || undefined,
        name: document.getElementById('recipe-name').value.trim(),
        description: document.getElementById('recipe-desc').value.trim(),
        coverImage: document.getElementById('recipe-cover').value.trim() || null,
        ingredients,
        steps,
        prepTime: parseInt(document.getElementById('recipe-prep').value) || 0,
        cookTime: parseInt(document.getElementById('recipe-cook').value) || 0,
        difficulty: difficultyEl ? difficultyEl.dataset.value : PRESET_TAGS.difficulty[0],
        videoUrl: document.getElementById('recipe-video').value.trim() || null,
        tags: {
          cuisine: getSelectedTags('recipe-cuisine-select'),
          type: getSelectedTags('recipe-type-select'),
          ingredient: document.getElementById('recipe-ingredient-tags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
          custom: document.getElementById('recipe-custom').value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
        }
      };

      await saveRecipe(data);
      await this.loadData();
      this.navigate('recipe-detail', { id: data.id });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
