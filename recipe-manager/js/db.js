/**
 * IndexedDB 数据库封装 - 菜谱管理系统
 */
const DB_NAME = 'RecipeManagerDB';
const DB_VERSION = 1;
const STORES = {
  RECIPES: 'recipes',
  CATEGORIES: 'categories',
  FAVORITES: 'favorites',
  WEEKLY_MENU: 'weekly_menu'
};

let db = null;

// 初始化数据库
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORES.RECIPES)) {
        const recipeStore = database.createObjectStore(STORES.RECIPES, { keyPath: 'id' });
        recipeStore.createIndex('name', 'name', { unique: false });
        recipeStore.createIndex('tags', 'tags', { multiEntry: true });
        recipeStore.createIndex('ingredientTags', 'ingredientTags', { multiEntry: true });
        recipeStore.createIndex('createdAt', 'createdAt', { unique: false });
        recipeStore.createIndex('difficulty', 'difficulty', { unique: false });
        recipeStore.createIndex('cuisine', 'cuisine', { multiEntry: true });
        recipeStore.createIndex('type', 'type', { multiEntry: true });
      }
      if (!database.objectStoreNames.contains(STORES.CATEGORIES)) {
        database.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.FAVORITES)) {
        database.createObjectStore(STORES.FAVORITES, { keyPath: 'recipeId' });
      }
      if (!database.objectStoreNames.contains(STORES.WEEKLY_MENU)) {
        const menuStore = database.createObjectStore(STORES.WEEKLY_MENU, { keyPath: 'id' });
        menuStore.createIndex('weekKey', 'weekKey', { unique: true });
      }
    };
  });
}

// 获取数据库实例
function getDB() {
  if (!db) return initDB();
  return Promise.resolve(db);
}

// 菜谱 CRUD
async function getAllRecipes() {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.RECIPES, 'readonly');
    const store = tx.objectStore(STORES.RECIPES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function getRecipe(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.RECIPES, 'readonly');
    const store = tx.objectStore(STORES.RECIPES);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveRecipe(recipe) {
  const database = await getDB();
  const data = {
    ...recipe,
    id: recipe.id || 'r_' + Date.now(),
    updatedAt: new Date().toISOString(),
    createdAt: recipe.createdAt || new Date().toISOString()
  };
  // 构建可搜索的食材标签
  const ingredients = data.ingredients || [];
  data.ingredientTags = ingredients.map(i => 
    (typeof i === 'string' ? i.split(/\s+/)[0] : i.name)?.trim()
  ).filter(Boolean);
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.RECIPES, 'readwrite');
    const store = tx.objectStore(STORES.RECIPES);
    const request = store.put(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

async function deleteRecipe(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.RECIPES, 'readwrite');
    const store = tx.objectStore(STORES.RECIPES);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 分类管理
async function getCategories() {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CATEGORIES, 'readonly');
    const store = tx.objectStore(STORES.CATEGORIES);
    const request = store.getAll();
    request.onsuccess = () => {
      const list = request.result || [];
      if (list.length === 0) {
        const defaults = {
          id: 'default',
          cuisine: ['中餐', '西餐', '日料', '韩餐', '东南亚'],
          type: ['主食', '汤类', '甜点', '小菜', '饮品', '凉菜'],
          ingredient: ['鸡肉', '牛肉', '猪肉', '羊肉', '海鲜', '素食', '蛋奶']
        };
        saveCategories(defaults).then(() => resolve(defaults));
      } else {
        resolve(list[0]);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function saveCategories(categories) {
  const database = await getDB();
  const data = { id: 'default', ...categories };
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.CATEGORIES, 'readwrite');
    const store = tx.objectStore(STORES.CATEGORIES);
    const request = store.put(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

// 收藏夹
async function getFavorites() {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.FAVORITES, 'readonly');
    const store = tx.objectStore(STORES.FAVORITES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function toggleFavorite(recipeId) {
  const database = await getDB();
  const favs = await getFavorites();
  const exists = favs.find(f => f.recipeId === recipeId);
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.FAVORITES, 'readwrite');
    const store = tx.objectStore(STORES.FAVORITES);
    const request = exists 
      ? store.delete(recipeId) 
      : store.put({ recipeId, addedAt: new Date().toISOString() });
    request.onsuccess = () => resolve(!exists);
    request.onerror = () => reject(request.error);
  });
}

async function isFavorite(recipeId) {
  const favs = await getFavorites();
  return favs.some(f => f.recipeId === recipeId);
}

// 每周菜单
async function getWeeklyMenu(weekKey) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.WEEKLY_MENU, 'readonly');
    const store = tx.objectStore(STORES.WEEKLY_MENU);
    const index = store.index('weekKey');
    const request = index.get(weekKey);
    request.onsuccess = () => resolve(request.result || { id: 'menu_' + weekKey, weekKey, days: {} });
    request.onerror = () => reject(request.error);
  });
}

async function saveWeeklyMenu(menu) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.WEEKLY_MENU, 'readwrite');
    const store = tx.objectStore(STORES.WEEKLY_MENU);
    const request = store.put(menu);
    request.onsuccess = () => resolve(menu);
    request.onerror = () => reject(request.error);
  });
}
