/**
生涯収支シミュレーター - 固定費・ライフイベント管理
固定費管理、ライフイベント管理、カスタムイベント管理、バリデーション
*/
// ===== 共通ヘルパー関数 =====
const createItemElement = (tag, className, htmlContent = '', attributes = {}) => {
const element = document.createElement(tag);
element.className = className;
if (htmlContent) element.innerHTML = htmlContent;
Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
return element;
};
const addInputListener = (element, eventType, callback) => {
if (element) element.addEventListener(eventType, callback);
};
// ===== 固定費管理システム =====
const FixedCostManager = {
render() {
const container = Utils.getElement('fixedCostsGrid');
if (!container) return;
container.innerHTML = ''; // コンテナをクリア
APP_DATA.categories.forEach(category => {
const savedCost = appState.fixedCosts[category.id] || { amount: 0, isActive: false };
container.appendChild(this.createCostItem(category, savedCost));
});
this.updateSummary();
},
createCostItem(category, savedCost) {
    const item = createItemElement('div', `fixed-cost-item ${savedCost.isActive ? 'active' : ''}`);
    item.innerHTML = `
        <div class="cost-icon">${category.icon}</div>
        <div class="cost-details">
            <h4 class="cost-name">${category.name}</h4>
            <p class="cost-description">${category.description}</p>
        </div>
        <div class="cost-controls">
            <div class="input-wrapper">
                <input type="number" class="cost-input form-control" id="cost-${category.id}"
                       placeholder="${category.placeholder || '0.0'}" value="${savedCost.amount || ''}"
                       min="0" max="${category.max || 100}" step="0.1"
                       aria-label="${category.name} 月額">
                <span class="input-unit">万円</span>
            </div>
        </div>`;
    addInputListener(item.querySelector(`#cost-${category.id}`), 'input', () => this.updateCosts());
    return item;
},

updateCosts() {
    let total = 0;
    const newFixedCosts = {};
    APP_DATA.categories.forEach(category => {
        const input = Utils.getElement(`cost-${category.id}`, false);
        if (!input) return;
        const amount = Utils.parseNumber(input.value, 0, 0, parseFloat(input.max));
        const isActive = amount > 0;
        newFixedCosts[category.id] = { amount, isActive };
        input.closest('.fixed-cost-item')?.classList.toggle('active', isActive);
        if (isActive) total += amount;
    });
    appState.fixedCosts = newFixedCosts;
    this.updateSummary();
    FormManager.autoSave();
},

updateSummary() {
    const total = Object.values(appState.fixedCosts).reduce((sum, cost) => cost.isActive ? sum + cost.amount : sum, 0);
    const totalFixedCostsEl = Utils.getElement('totalFixedCosts', false);
    if (totalFixedCostsEl) {
        totalFixedCostsEl.textContent = Utils.formatCurrency(total);
    }

    const income = appState.basicInfo.income || 0;
    const ratio = income > 0 ? (total / income * 100) : 0;
    const fixedCostsRatioEl = Utils.getElement('fixedCostsRatio', false);
    if (fixedCostsRatioEl) {
        fixedCostsRatioEl.textContent = `${ratio.toFixed(0)}%`;
    }
    this.updateRatioAdvice(ratio);
},

updateRatioAdvice(ratio) {
    const adviceElement = Utils.getElement('ratioAdvice', false);
    if (!adviceElement) return;
    let message = '', className = 'ratio-advice';
    if (ratio === 0 && Object.values(appState.fixedCosts).every(c => !c.isActive || c.amount === 0)) {
         message = '固定費が入力されていません。生活費の目安として、収入の30%〜50%が一般的です。';
         className += ' info';
    } else if (ratio <= 30) {
        message = '理想的な固定費の割合です。'; className += ' success'; // 修正: successクラス
    } else if (ratio <= 50) {
        message = '固定費は収入の50%以下に抑えるのが理想です。見直せる項目がないか確認しましょう。'; className += ' warning';
    } else {
        message = '固定費が高すぎます。家計の見直しを強くおすすめします。'; className += ' error'; // 修正: errorクラス
    }
    adviceElement.textContent = message;
    adviceElement.className = className;
}

};
// ===== ライフイベント管理システム =====
const LifeEventManager = {
render() {
const container = Utils.getElement('lifeEventsGrid');
if (!container) return;
container.innerHTML = ''; // コンテナをクリア
APP_DATA.lifeEvents.forEach(event => container.appendChild(this.createEventItem(event)));
this.updateDetailSettingsVisibility();
},
createEventItem(event) {
    const isSelected = appState.lifeEvents[event.key] || false;
    const item = createItemElement('div', `life-event-item ${isSelected ? 'selected' : ''}`, `
        <div class="event-icon">${event.icon}</div>
        <div class="event-content">
            <h4 class="event-text">${event.text}</h4>
            <p class="event-description">${event.description}</p>
        </div>
        <div class="toggle-switch ${isSelected ? 'active' : ''}" role="switch" aria-checked="${isSelected}" tabindex="0" aria-label="${event.text}">
            <div class="toggle-slider"></div>
        </div>`,
        { 'data-event-key': event.key }
    );

    const toggleSwitch = item.querySelector('.toggle-switch');
    const toggleHandler = () => this.toggleEvent(event.key, item, toggleSwitch);

    item.addEventListener('click', (e) => { // クリック対象をトグルスイッチかアイテム全体か明確に
        if (e.target.closest('.toggle-switch') || e.target === item) {
            toggleHandler();
        }
    });
    toggleSwitch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleHandler();
        }
    });
    return item;
},

toggleEvent(eventKey, itemElement, toggleSwitchElement) {
    const newState = !(appState.lifeEvents[eventKey] || false);
    appState.lifeEvents[eventKey] = newState;
    itemElement.classList.toggle('selected', newState);
    toggleSwitchElement.classList.toggle('active', newState);
    toggleSwitchElement.setAttribute('aria-checked', newState);
    this.updateDetailSettingsVisibility();
    FormManager.autoSave();
    // アクセシビリティ通知は省略（コード短縮のため）
},

updateDetailSettingsVisibility() {
    APP_DATA.lifeEvents.forEach(event => {
        if (event.detailSettingKey) {
            const group = Utils.getElement(event.detailSettingKey, false);
            if (group) {
                const isVisible = appState.lifeEvents[event.key] || false;
                group.style.display = isVisible ? 'block' : 'none';
                group.querySelectorAll('input, select').forEach(input => input.required = isVisible);
            }
        }
    });
}

};
// ===== カスタムライフイベント管理システム =====
const CustomEventManager = {
setup() {
addInputListener(Utils.getElement('addCustomEventButton', false), 'click', () => this.showForm());
addInputListener(Utils.getElement('saveCustomEventButton', false), 'click', () => this.saveEvent());
addInputListener(Utils.getElement('cancelCustomEventButton', false), 'click', () => this.hideForm());
addInputListener(Utils.getElement('customLifeEventsList', false), 'click', (e) => this.handleListClick(e));
this.render();
},
render() {
    const listContainer = Utils.getElement('customLifeEventsList');
    const placeholder = Utils.getElement('customEventsPlaceholder');
    if (!listContainer || !placeholder) return;

    listContainer.innerHTML = ''; // リストをクリア
    if (appState.customLifeEvents.length === 0) {
        placeholder.style.display = 'flex'; // flexで中央揃えなどに対応
        return;
    }
    placeholder.style.display = 'none';
    appState.customLifeEvents.forEach(event => listContainer.appendChild(this.createEventItem(event)));
},

createEventItem(event) {
    return createItemElement('div', 'custom-event-item', `
        <div class="custom-event-details">
            <h5 class="custom-event-name">${Utils.sanitizeHtml(event.name)}</h5>
            <p class="custom-event-info">
                <span class="amount">${Utils.formatCurrency(event.amount)}</span>
                <span class="age">(${event.age}歳時)</span>
            </p>
        </div>
        <div class="custom-event-actions">
            <button type="button" class="custom-event-action" data-id="${event.id}" data-action="edit" aria-label="編集: ${Utils.sanitizeHtml(event.name)}">
                <svg class="icon"><use xlink:href="#icon-edit"></use></svg>
            </button>
            <button type="button" class="custom-event-action delete" data-id="${event.id}" data-action="delete" aria-label="削除: ${Utils.sanitizeHtml(event.name)}">
                <svg class="icon"><use xlink:href="#icon-trash"></use></svg>
            </button>
        </div>`);
},

showForm(isEdit = false, eventData = null) {
    const formContainerEl = Utils.getElement('customEventFormContainer', false);
    if (formContainerEl) {
        formContainerEl.style.display = 'block';
    }

    const addCustomEventButtonEl = Utils.getElement('addCustomEventButton', false);
    if (addCustomEventButtonEl) {
        addCustomEventButtonEl.style.display = 'none';
    }

    const customEventFormTitleEl = Utils.getElement('customEventFormTitle', false);
    if (customEventFormTitleEl) {
        customEventFormTitleEl.textContent = isEdit ? '支出の編集' : '支出の追加';
    }
    const form = Utils.getElement('customEventFormContainer')?.querySelector('form') || Utils.getElement('customEventForm'); // form要素を特定

   if (isEdit && eventData) {
        ['id', 'name', 'amount', 'age'].forEach(key => {
            const input = Utils.getElement(`customEvent${key.charAt(0).toUpperCase() + key.slice(1)}`, false);
            if (input) input.value = eventData[key] || '';
        });
    } else {
        this.resetForm();
    }
    setTimeout(() => Utils.getElement('customEventName', false)?.focus(), 50);
},

hideForm() {
    const formContainerEl = Utils.getElement('customEventFormContainer', false);
    if (formContainerEl) {
        formContainerEl.style.display = 'none';
    }

    const addCustomEventButtonEl = Utils.getElement('addCustomEventButton', false);
    if (addCustomEventButtonEl) {
        addCustomEventButtonEl.style.display = 'inline-flex';
    }
    this.resetForm();
},

resetForm() {
    ['Id', 'Name', 'Amount', 'Age'].forEach(suffix => {
        const el = Utils.getElement(`customEvent${suffix}`, false);
        if (el) el.value = '';
        UIManager.clearError(`customEvent${suffix}`);
    });
},

saveEvent() {
    const id = Utils.getElement('customEventId')?.value;
    const name = Utils.getElement('customEventName')?.value.trim();
    const amount = Utils.parseNumber(Utils.getElement('customEventAmount')?.value, 0, 1);
    const age = Utils.parseInt(Utils.getElement('customEventAge')?.value, 0, 18, 100);

    if (!this.validateEvent(name, amount, age)) return;

    const eventIndex = id ? appState.customLifeEvents.findIndex(e => e.id === id) : -1;
    if (eventIndex > -1) {
        appState.customLifeEvents[eventIndex] = { id, name, amount, age };
    } else {
        appState.customLifeEvents.push({ id: Utils.generateId(), name, amount, age });
    }
    this.render();
    this.hideForm();
    FormManager.autoSave();
    NotificationManager.show(id ? '支出を更新しました' : '支出を追加しました', 'success');
},

validateEvent(name, amount, age) {
    let isValid = true;
    const showError = (field, msg) => { UIManager.showError(field, msg); isValid = false; };

    if (!name) showError('customEventName', '支出名を入力してください');
    else if (name.length > 30) showError('customEventName', '支出名は30文字以内で入力');
    else UIManager.clearError('customEventName');

    if (amount < 1 || amount > 10000) showError('customEventAmount', '金額は1〜10,000万円で入力');
    else UIManager.clearError('customEventAmount');

    const currentAge = Utils.calculateAge(appState.basicInfo.birthday);
    if (age < (currentAge || 18) || age > (appState.advancedSettings.expectedLifeExpectancy || 100)) {
         showError('customEventAge', `年齢は${currentAge || 18}〜${appState.advancedSettings.expectedLifeExpectancy || 100}歳で入力`);
    } else UIManager.clearError('customEventAge');

    return isValid;
},

handleListClick(e) {
    const button = e.target.closest('button.custom-event-action');
    if (!button) return;
    const eventId = button.dataset.id;
    const action = button.dataset.action;
    const eventData = appState.customLifeEvents.find(ev => ev.id === eventId);
    if (!eventData) return;

    if (action === 'edit') this.showForm(true, eventData);
    else if (action === 'delete') this.deleteEvent(eventId, eventData.name);
},

deleteEvent(eventId, eventName) {
    if (!confirm(`「${Utils.sanitizeHtml(eventName)}」を削除しますか？`)) return; // サニタイズ
    appState.customLifeEvents = appState.customLifeEvents.filter(e => e.id !== eventId);
    this.render();
    FormManager.autoSave();
    NotificationManager.show('支出を削除しました', 'success');
}

};
// ===== バリデーション管理システム =====
const StepValidator = {
validateStep(stepNumber) {
const errors = new Map(); // Mapのまま活用
const addError = (field, msg) => errors.set(field, msg);
switch (stepNumber) {
        case 1: this.validateBasicInfo(addError); this.validatePension(addError); break;
        case 2: this.validateFixedCosts(addError); break;
        case 3: this.validateLifeEvents(addError); break;
        case 4: this.validateAdvancedSettings(addError); break;
    }
    errors.forEach((msg, field) => UIManager.showError(field, msg));
    if (errors.size > 0) {
         const firstErrorField = Utils.getElement(errors.keys().next().value, false);
         firstErrorField?.focus();
         return false; // エラーがある場合はfalse
    }
    return true; // エラーがない場合はtrue
},

validateBasicInfo(addError) {
    if (!appState.basicInfo.birthday) addError('birthYear', '生年月日を選択してください'); // birthYearを対象に
    const { income, occupation } = appState.basicInfo;
    if (income === null || income < 5 || income > 300) addError('income', '手取り収入を5〜300万円で入力');
    if (!occupation) addError('occupation', '職業を選択してください');
},

validatePension(addError) {
    const { nationalPension実績Years: npH, nationalPension予定Years: npF,
            employeePension実績Years: epH, employeePension予定Years: epF } = appState.basicInfo;
    if (npH < 0 || npH > 40) addError('nationalPension実績Years', '国民年金実績は0〜40年');
    if (npF < 0 || npF > 40) addError('nationalPension予定Years', '国民年金予定は0〜40年');
    if (npH + npF > 40) addError('nationalPension予定Years', '国民年金合計は最大40年'); // エラー表示対象を調整

    if (epH < 0 || epH > 52) addError('employeePension実績Years', '厚生年金実績は0〜52年');
    if (epF < 0 || epF > 52) addError('employeePension予定Years', '厚生年金予定は0〜52年');
    if (epH + epF > 52) addError('employeePension予定Years', '厚生年金合計は最大52年');
},

validateFixedCosts(addError) {
    const totalCosts = Object.values(appState.fixedCosts).reduce((sum, cost) => cost.isActive ? sum + cost.amount : sum, 0);
    const income = appState.basicInfo.income || 0;
    // 収入の100%を超える場合に警告（閾値は要件次第）
    if (income > 0 && totalCosts > income ) {
        addError('totalFixedCosts', '固定費合計が収入を超えています。見直してください。');
    }
     // 食費警告
    const foodCost = appState.fixedCosts.food?.amount || 0;
    if (foodCost > 6) { // 6万円超
        // addError('cost-food', '食費が高めです。節約のヒントを参考にしてください。'); // UIに表示するなら
        NotificationManager.show('食費が月6万円を超えています。節約を検討しましょう。', 'warning', 5000);
    }
},

validateLifeEvents(addError) {
    const { children, housing, nisa } = appState.lifeEvents;
    const { childrenCount, housingAge, nisaAmount } = appState.detailSettings;
    const currentAge = Utils.calculateAge(appState.basicInfo.birthday);

    if (children && (childrenCount < 0 || childrenCount > 10)) addError('childrenCount', '子供の人数は0〜10人'); // 0人も許容
    if (housing && (housingAge < (currentAge || 20) || housingAge > 70)) addError('housingAge', `住宅購入年齢は${currentAge || 20}〜70歳`);
    if (nisa && (nisaAmount < 0.1 || nisaAmount > 30)) addError('nisaAmount', 'NISA月額は0.1〜30万円');

    const formContainer = Utils.getElement('customEventFormContainer', false);
    if (formContainer && formContainer.style.display === 'block') {
        addError('addCustomEventButton', '「大きな支出」の入力フォームを閉じてください');
    }
},

validateAdvancedSettings(addError) {
    const { retirementAge, expectedLifeExpectancy, investmentReturnRate } = appState.advancedSettings;
    const currentAge = Utils.calculateAge(appState.basicInfo.birthday) || 18; // 最低年齢
    if (retirementAge < Math.max(55, currentAge) || retirementAge > 75) addError('retirementAge', `リタイア年齢は${Math.max(55, currentAge)}〜75歳`);
    if (expectedLifeExpectancy < Math.max(80, retirementAge + 1) || expectedLifeExpectancy > 100) addError('expectedLifeExpectancy', `想定寿命は${Math.max(80, retirementAge + 1)}〜100歳`);
    if (investmentReturnRate < 0 || investmentReturnRate > 15) addError('investmentReturnRate', '期待利回りは0〜15%');
}

};
if (typeof module !== 'undefined' && module.exports) {
module.exports = { FixedCostManager, LifeEventManager, CustomEventManager, StepValidator };
}