/**
 * 生涯収支シミュレーター - コア機能
 * アプリケーション設定、状態管理、基本ユーティリティ
 */

// ===== アプリケーション設定 =====
const APP_CONFIG = {
    VERSION: '3.0.0',
    STORAGE_KEY: 'lifetimeSimulatorData_v3',
    DEBOUNCE_DELAY: 300,
    ANIMATION_DURATION: 300,
    NOTIFICATION_DURATION: 4000,
    CALCULATION_DELAY: 1500,
    MAX_RETRIES: 3
};

// ===== アプリケーションデータ =====
const APP_DATA = {
    categories: [
        { id: "housing", name: "住居費", icon: "🏠", placeholder: "8.0", max: 50, description: "家賃、住宅ローン、管理費、固定資産税など" },
        { id: "food", name: "食費", icon: "🍽️", placeholder: "6.0", max: 20, description: "外食費、食材費、お弁当代など" },
        { id: "utilities", name: "水道光熱費", icon: "⚡", placeholder: "2.0", max: 10, description: "電気、ガス、水道の基本料金+使用料" },
        { id: "communication", name: "通信費", icon: "📱", placeholder: "1.0", max: 5, description: "携帯電話、インターネット、固定電話など" },
        { id: "insurance", name: "保険料", icon: "🛡️", placeholder: "1.5", max: 10, description: "生命保険、医療保険、火災保険など" },
        { id: "vehicle", name: "自動車関連費", icon: "🚗", placeholder: "3.0", max: 10, description: "ローン、駐車場代、保険、車検、ガソリン代など" },
        { id: "education", name: "教育・自己投資費", icon: "📚", placeholder: "1.0", max: 20, description: "自身の学習、子供の習い事（学費本体除く）など" },
        { id: "subscriptions", name: "サブスクリプション", icon: "📺", placeholder: "0.3", max: 5, description: "動画・音楽配信、アプリなど" },
        { id: "others", name: "その他固定費", icon: "📦", placeholder: "1.0", max: 10, description: "こづかい、趣味、定期購入、ペット費用など" }
    ],
    lifeEvents: [
        { id: 1, key: "marriage", text: "結婚予定はありますか？", description: "平均費用：約300万円（一時費用）", icon: "💍", cost: 300, isOneTime: true },
        { id: 2, key: "car", text: "車の購入予定はありますか？", description: "購入費用：10年ごとに約200-300万円 + 維持費：月3-5万円程度", icon: "🚗", cost: 250, recurringCostPerYear: 48, isOneTime: false, costInterval: 10 },
        { id: 3, key: "children", text: "出産・子育て予定はありますか？", description: "子育て費用：1人あたり約1500-2000万円（大学卒業まで）", icon: "👶", cost: 1800, hasDetail: true, detailSettingKey: 'childrenCountGroup' },
        { id: 4, key: "housing", text: "住宅購入予定はありますか？", description: "住宅費用：約3000-5000万円 + 固定資産税等", icon: "🏠", cost: 3500, hasDetail: true, detailSettingKey: 'housingAgeGroup', isOneTime: true },
        { id: 5, key: "caregiving", text: "親の介護費用の準備は必要ですか？", description: "介護費用：一時金 約100万円、月額 約8万円程度", icon: "👴", cost: 100, recurringCostPerYear: 96, isOneTime: false },
        { id: 6, key: "travel", text: "海外旅行などの大きな娯楽費を考慮しますか？", description: "例: 5年ごとに100万円の大型旅行など", icon: "✈️", cost: 100, isOneTime: false, costInterval: 5 },
        { id: 7, key: "nisa", text: "つみたてNISAなどの投資を行いますか？", description: "月々の積立投資（結果は運用益として反映）", icon: "📈", hasDetail: true, investment: true, detailSettingKey: 'nisaAmountGroup' }
    ],
    defaultAdvancedSettings: {
        retirementAge: 65,
        expectedLifeExpectancy: 95,
        investmentReturnRate: 3.0,
    }
};

// ===== アプリケーション状態 =====
class AppState {
    constructor() {
        this.currentStep = 1;
        this.farthestValidatedStep = 1;
        this.basicInfo = {
            birthday: null,
            income: null,
            occupation: '',
            nationalPension実績Years: 0,
            nationalPension予定Years: 20,
            employeePension実績Years: 0,
            employeePension予定Years: 20,
        };
        this.fixedCosts = {};
        this.lifeEvents = {};
        this.customLifeEvents = [];
        this.detailSettings = {
            childrenCount: 1,
            housingAge: 35,
            nisaAmount: 3.3
        };
        this.advancedSettings = { ...APP_DATA.defaultAdvancedSettings };
        this.results = {};
        this.validationErrors = new Map();
        this.isCalculating = false;
    }

    // 状態の深いコピーを作成
    clone() {
        return JSON.parse(JSON.stringify(this));
    }

    // 状態の検証
    validate() {
        const errors = new Map();
        
        // Step 1の検証
        if (!this.basicInfo.birthday) {
            errors.set('birthDate', '生年月日を選択してください');
        }
        if (!this.basicInfo.income || this.basicInfo.income < 5 || this.basicInfo.income > 300) {
            errors.set('income', '手取り収入を5〜300万円の範囲で入力してください');
        }
        if (!this.basicInfo.occupation) {
            errors.set('occupation', '職業を選択してください');
        }

        this.validationErrors = errors;
        return errors.size === 0;
    }
}

// ===== グローバル変数 =====
let appState = new AppState();
let lifetimeChart = null;
let debounceTimers = new Map();
let currentNotificationId = 0;

// ===== ユーティリティ関数 =====
const Utils = {
    // デバウンス処理
    debounce(key, func, delay = APP_CONFIG.DEBOUNCE_DELAY) {
        if (debounceTimers.has(key)) {
            clearTimeout(debounceTimers.get(key));
        }

        const timerId = setTimeout(() => {
            func();
            debounceTimers.delete(key);
        }, delay);

        debounceTimers.set(key, timerId);
    },

    // 要素取得（エラーハンドリング付き）
    getElement(id, throwOnMissing = true) {
        const element = document.getElementById(id);
        if (!element && throwOnMissing) {
            console.warn(`Element with id '${id}' not found`);
        }
        return element;
    },

    // 安全な数値パース
    parseNumber(value, defaultValue = 0, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
        if (value === null || value === undefined || value === '') {
            return defaultValue;
        }
        
        const num = parseFloat(value);
        if (isNaN(num)) {
            return defaultValue;
        }
        
        return Math.min(max, Math.max(min, num));
    },

    // 安全な整数パース
    parseInt(value, defaultValue = 0, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
        const num = this.parseNumber(value, defaultValue, min, max);
        return Math.round(num);
    },

    // 年齢計算
    calculateAge(birthDate) {
        if (!birthDate) return null;
        
        const today = new Date();
        const birth = new Date(birthDate);
        
        if (birth > today) return null;
        
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return Math.max(0, age);
    },

    // 通貨フォーマット
    formatCurrency(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '---';
        }
        
        const absAmount = Math.abs(amount);
        const isNegative = amount < 0;
        const prefix = isNegative ? '-' : '';
        
        if (absAmount >= 10000) {
            return `${prefix}${(absAmount / 10000).toFixed(1)}億円`;
        } else if (absAmount >= 1) {
            return `${prefix}${absAmount.toFixed(0)}万円`;
        } else {
            return `${prefix}${(absAmount * 10).toFixed(0)}千円`;
        }
    },

    // ID生成
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    },

    // 配列の安全な操作
    safeArrayAccess(array, index, defaultValue = null) {
        return Array.isArray(array) && array.length > index ? array[index] : defaultValue;
    },

    // オブジェクトの安全なプロパティアクセス
    safeGet(obj, path, defaultValue = null) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : defaultValue;
        }, obj);
    },

    // 日付フォーマット
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    },

    // 文字列のサニタイズ
    sanitizeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // 数値範囲の制限
    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    },

    // ローディング状態の管理
    setLoading(isLoading, message = 'Loading...') {
        const loader = this.getElement('loadingContainer', false);
        if (loader) {
            loader.style.display = isLoading ? 'flex' : 'none';
            
            const messageElement = loader.querySelector('.loading-message');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
    },

    // エラーの安全な処理
    handleError(error, context = 'Unknown') {
        console.error(`Error in ${context}:`, error);
        
        // ユーザーフレンドリーなエラーメッセージを表示
        const userMessage = this.getUserFriendlyErrorMessage(error);
        if (window.NotificationManager) {
            NotificationManager.show(userMessage, 'error');
        }
        
        // 開発環境では詳細情報を表示
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.trace();
        }
    },

    // ユーザーフレンドリーなエラーメッセージ
    getUserFriendlyErrorMessage(error) {
        if (error.message) {
            // 既知のエラーパターンをチェック
            if (error.message.includes('network') || error.message.includes('fetch')) {
                return 'ネットワークエラーが発生しました。接続を確認してください。';
            }
            if (error.message.includes('validation')) {
                return '入力内容に問題があります。確認してください。';
            }
            if (error.message.includes('calculation')) {
                return '計算中にエラーが発生しました。入力内容を確認してください。';
            }
        }
        
        return 'エラーが発生しました。しばらく待ってから再試行してください。';
    }
};

// モジュールエクスポート（必要に応じて）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        APP_CONFIG,
        APP_DATA,
        AppState,
        Utils,
        appState
    };
}
