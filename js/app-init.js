/**
生涯収支シミュレーター - アプリケーション初期化
ナビゲーション管理、アプリ初期化、デバッグ機能、メイン起動処理
*/
// ===== ナビゲーション管理システム =====
const NavigationManager = {
// 次のステップへ進む
nextStep() {
if (!StepValidator.validateStep(appState.currentStep)) { // 修正: StepValidator.validateStep の返り値を直接評価
NotificationManager.show('入力内容を確認してください', 'error');
return;
}
FormManager.saveCurrentStepData();

    if (appState.currentStep < 5) {
        appState.currentStep++;
        appState.farthestValidatedStep = Math.max(appState.farthestValidatedStep, appState.currentStep);
        UIManager.showStep(appState.currentStep);
        NotificationManager.show('次のステップに進みました', 'success', 2000);
    }
},

// 前のステップに戻る
previousStep() {
    if (appState.currentStep > 1) {
        FormManager.saveCurrentStepData(); // 現ステップのデータは保存することが望ましい
        appState.currentStep--;
        UIManager.showStep(appState.currentStep);
    }
},

// 指定したステップに移動
goToStep(targetStep) {
    if (targetStep === appState.currentStep) return;

    if (targetStep < appState.currentStep && targetStep <= appState.farthestValidatedStep) {
        FormManager.saveCurrentStepData(); // 移動前に現ステップのデータを保存
        appState.currentStep = targetStep;
        UIManager.showStep(appState.currentStep);
    } else if (targetStep <= appState.farthestValidatedStep) {
        if (!StepValidator.validateStep(appState.currentStep)) { // 修正: StepValidator.validateStep の返り値を直接評価
            NotificationManager.show('現在のステップの入力内容を修正してください', 'error');
            return;
        }
        FormManager.saveCurrentStepData();
        appState.currentStep = targetStep;
        UIManager.showStep(appState.currentStep);
    } else {
        NotificationManager.show('まだこのステップには進めません。順番に入力してください', 'info');
    }
}

};
// ===== アプリケーション初期化 =====
const AppInitializer = {
// メイン初期化関数
async init() {
try {
console.log('アプリケーション初期化開始');
await this.loadData();
ValidationManager.setupValidationRules(); // 既存のValidationManagerを使用
this.initializeUI();
this.setupEventListeners();
FormManager.restoreFormData();
this.updateInitialDisplay();
console.log('アプリケーション初期化完了');
} catch (error) {
Utils.handleError(error, 'Application initialization');
}
},
async loadData() {
    const savedData = StorageManager.load();
    if (savedData) {
        Object.assign(appState, {
            currentStep: savedData.currentStep || 1,
            farthestValidatedStep: savedData.farthestValidatedStep || 1,
            basicInfo: { ...appState.basicInfo, ...savedData.basicInfo },
            fixedCosts: { ...appState.fixedCosts, ...savedData.fixedCosts },
            lifeEvents: { ...appState.lifeEvents, ...savedData.lifeEvents },
            customLifeEvents: Array.isArray(savedData.customLifeEvents) ? savedData.customLifeEvents : [],
            detailSettings: { ...appState.detailSettings, ...savedData.detailSettings },
            advancedSettings: { ...APP_DATA.defaultAdvancedSettings, ...savedData.advancedSettings },
            results: savedData.results || {}
        });
    }
},

initializeUI() {
    FormManager.setupBirthdaySelects();
    PensionManager.setupInputs();
    FixedCostManager.render();
    LifeEventManager.render(); // 修正: LifeEventManagerのrenderメソッドを呼び出し
    CustomEventManager.setup();
    UIManager.updatePlaceholders(false); // 修正: UIManagerのメソッドを呼び出し
},

setupEventListeners() {
    this.setupBasicInfoListeners();
    this.setupNavigationListeners();
    this.setupAdvancedSettingsListeners();
    this.setupGlobalListeners();
},

setupBasicInfoListeners() {
    const incomeInput = Utils.getElement('income', false);
    if (incomeInput) {
        incomeInput.addEventListener('input', () => {
            Utils.debounce('updateIncome', () => {
                appState.basicInfo.income = Utils.parseNumber(incomeInput.value, null, 5, 300);
                PensionManager.calculate();
                FixedCostManager.updateSummary(); // FixedCostManager のメソッドを呼び出し
                UIManager.clearError('income');
                FormManager.autoSave();
            });
        });
    }

    const occupationSelect = Utils.getElement('occupation', false);
    if (occupationSelect) {
        occupationSelect.addEventListener('change', () => {
            appState.basicInfo.occupation = occupationSelect.value;
            const age = Utils.calculateAge(appState.basicInfo.birthday);
            if (age !== null) {
                PensionManager.adjustByAge(age);
            }
            UIManager.clearError('occupation');
            FormManager.autoSave();
        });
    }
},

setupNavigationListeners() {
    document.querySelectorAll('.step-label').forEach(label => {
        label.addEventListener('click', () => {
            const targetStep = parseInt(label.dataset.step);
            NavigationManager.goToStep(targetStep);
        });
    });
    window.nextStep = () => NavigationManager.nextStep();
    window.prevStep = () => NavigationManager.previousStep();
    window.calculateResults = () => CalculationEngine.calculate();
    window.resetApp = () => this.resetApplication();
    window.exportResults = () => this.exportResults();
},

setupAdvancedSettingsListeners() {
    const advancedFields = ['retirementAge', 'expectedLifeExpectancy', 'investmentReturnRate'];
    advancedFields.forEach(fieldId => {
        const element = Utils.getElement(fieldId, false);
        if (element) {
            element.addEventListener('change', () => { // 'change' の方が適切
                const value = Utils.parseNumber(element.value); // 'change'ならdebounce不要
                appState.advancedSettings[fieldId] = value;
                if (fieldId === 'retirementAge') {
                    const age = Utils.calculateAge(appState.basicInfo.birthday);
                    if (age !== null) PensionManager.adjustByAge(age);
                }
                UIManager.clearError(fieldId);
                FormManager.autoSave();
            });
        }
    });

    const detailFields = [
        { id: 'childrenCount', key: 'childrenCount', parseFn: Utils.parseInt },
        { id: 'housingAge', key: 'housingAge', parseFn: Utils.parseInt },
        { id: 'nisaAmount', key: 'nisaAmount', parseFn: Utils.parseNumber }
    ];
    detailFields.forEach(field => {
        const element = Utils.getElement(field.id, false);
        if (element) {
            element.addEventListener('input', () => {
                Utils.debounce(`update_${field.key}`, () => {
                    appState.detailSettings[field.key] = field.parseFn(element.value);
                    UIManager.clearError(field.id);
                    FormManager.autoSave();
                });
            });
        }
    });
},

setupGlobalListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const customEventForm = Utils.getElement('customEventFormContainer', false);
            if (customEventForm && customEventForm.style.display === 'block') { // 修正: CustomEventManagerのメソッドを呼び出し
                CustomEventManager.hideForm();
            }
        }
    });
    window.addEventListener('error', (e) => Utils.handleError(e.error, 'Global error handler'));
    window.addEventListener('unhandledrejection', (e) => Utils.handleError(e.reason, 'Unhandled promise rejection'));
},

updateInitialDisplay() {
    UIManager.showStep(appState.currentStep);
    setTimeout(() => PensionManager.calculate(), 100);
    FixedCostManager.updateSummary(); // FixedCostManager のメソッドを呼び出し
    LifeEventManager.updateDetailSettingsVisibility(); // LifeEventManager のメソッドを呼び出し
},

resetApplication() {
    if (!confirm('入力内容をすべてリセットして最初からやり直しますか？\n\n※この操作は取り消せません。')) return;
    try {
        StorageManager.clear();
        appState = new AppState(); // AppStateクラスをインスタンス化
        if (lifetimeChart) {
            lifetimeChart.destroy();
            lifetimeChart = null;
        }
        this.resetAllForms();
        this.resetUI();
        UIManager.showStep(1);
        this.initializeUI();
        FormManager.restoreFormData();
        NotificationManager.show('データをリセットしました', 'success');
    } catch (error) {
        Utils.handleError(error, 'Application reset');
    }
},

resetAllForms() {
    document.querySelectorAll('input[type="number"], input[type="text"], select').forEach(input => {
        if (APP_DATA.defaultAdvancedSettings.hasOwnProperty(input.id)) {
            input.value = APP_DATA.defaultAdvancedSettings[input.id];
        } else if (input.id in appState.detailSettings) { // appStateの初期値を使用
            input.value = new AppState().detailSettings[input.id];
        } else {
            input.value = '';
        }
        input.classList.remove('error');
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
    });
    document.querySelectorAll('.input-error-message').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.pension-guidance-message').forEach(el => el.style.display = 'none');
},

resetUI() {
    ['ageDisplay', 'pensionEstimate', 'customEventFormContainer'].forEach(id => {
        const element = Utils.getElement(id, false);
        if (element) element.style.display = 'none';
    });
    const addButton = Utils.getElement('addCustomEventButton', false);
    if (addButton) addButton.style.display = 'inline-flex'; // 修正: inline-flex
    UIManager.updatePlaceholders(false);
    const ratioAdvice = Utils.getElement('ratioAdvice', false);
    if (ratioAdvice) {
        ratioAdvice.textContent = '';
        ratioAdvice.className = 'ratio-advice';
    }
},

exportResults() {
    try {
        if (!appState.results.yearlyData || appState.results.yearlyData.length === 0) {
            NotificationManager.show('まずシミュレーションを実行してください', 'error');
            return;
        }
        const exportData = this.generateExportData();
        this.downloadExportData(exportData);
    } catch (error) {
        Utils.handleError(error, 'Results export');
    }
},

generateExportData() {
    const currentAge = Utils.calculateAge(appState.basicInfo.birthday);
    return {
        シミュレーション実行日時: new Date().toLocaleString('ja-JP'),
        評価: appState.results.rating,
        入力情報: {
            基本: {
                生年月日: appState.basicInfo.birthday ? Utils.formatDate(appState.basicInfo.birthday) : '--',
                現在年齢: `${currentAge !== null ? currentAge : '--'}歳`,
                月の手取り収入: `${appState.basicInfo.income !== null ? appState.basicInfo.income : '--'}万円`,
                職業: this.getOccupationText(appState.basicInfo.occupation),
                国民年金実績: `${appState.basicInfo.nationalPension実績Years}年`,
                国民年金予定: `${appState.basicInfo.nationalPension予定Years}年`,
                厚生年金実績: `${appState.basicInfo.employeePension実績Years}年`,
                厚生年金予定: `${appState.basicInfo.employeePension予定Years}年`
            },
            固定費: this.getFixedCostsText(),
            ライフイベント: this.getLifeEventsText(),
            その他の大きな支出: this.getCustomEventsText(),
            詳細設定: {
                リタイア希望年齢: `${appState.advancedSettings.retirementAge}歳`,
                想定寿命: `${appState.advancedSettings.expectedLifeExpectancy}歳`,
                期待運用利回り: `${appState.advancedSettings.investmentReturnRate}%`
            }
        },
        予測結果: {
            生涯総収入: Utils.formatCurrency(appState.results.totalIncome),
            生涯総支出: Utils.formatCurrency(appState.results.totalExpenses),
            [`${appState.advancedSettings.expectedLifeExpectancy}歳時点総資産`]: Utils.formatCurrency(appState.results.finalBalance),
            [`${appState.advancedSettings.retirementAge}歳時点総資産`]: Utils.formatCurrency(appState.results.retirementAssets),
            NISA最終評価額: Utils.formatCurrency(appState.results.nisaFinalBalance)
        },
        アドバイスの要約: this.getAdviceSummary(),
        年間データ: appState.results.yearlyData.map(d => ({
            年齢: d.age,
            総資産: Utils.formatCurrency(d.totalAssets),
            現金: Utils.formatCurrency(d.cumulativeCash),
            NISA: Utils.formatCurrency(d.nisaBalance),
            年間収入: Utils.formatCurrency(d.income),
            年間支出: Utils.formatCurrency(d.cashExpense) // 修正: cashExpense を使用
        }))
    };
},

getOccupationText(key) {
    const occupationSelect = Utils.getElement('occupation', false);
    if (!occupationSelect) return key;
    const option = Array.from(occupationSelect.options).find(opt => opt.value === key);
    return option ? option.textContent : key;
},

getFixedCostsText() {
    const activeCosts = Object.entries(appState.fixedCosts)
        .filter(([_, cost]) => cost.isActive && cost.amount > 0) // amount > 0 も考慮
        .map(([id, cost]) => {
            const category = APP_DATA.categories.find(c => c.id === id);
            return `${category?.name || id}: ${Utils.formatCurrency(cost.amount)}`;
        });
    return activeCosts.length > 0 ? activeCosts.join('、') : '入力なし';
},

getLifeEventsText() {
    const activeEvents = Object.entries(appState.lifeEvents)
        .filter(([_, isActive]) => isActive)
        .map(([key]) => { // 修正: アンダースコアを削除
            const eventConfig = APP_DATA.lifeEvents.find(e => e.key === key);
            let eventText = eventConfig ? eventConfig.text : key;
            if (eventConfig?.hasDetail) {
                if (key === 'children') eventText += ` (${appState.detailSettings.childrenCount}人)`;
                else if (key === 'housing') eventText += ` (${appState.detailSettings.housingAge}歳購入)`;
                else if (key === 'nisa') eventText += ` (月${Utils.formatCurrency(appState.detailSettings.nisaAmount)})`;
            }
            return eventText;
        });
    return activeEvents.length > 0 ? activeEvents.join('、') : '選択なし';
},

getCustomEventsText() {
    if (appState.customLifeEvents.length === 0) return 'なし';
    return appState.customLifeEvents
        .map(e => `${Utils.sanitizeHtml(e.name)}: ${Utils.formatCurrency(e.amount)} (${e.age}歳時)`)
        .join('、');
},

getAdviceSummary() { // 結果表示とロジックを合わせる
    const adviceContainer = Utils.getElement('adviceContent', false);
    if (adviceContainer && adviceContainer.textContent.trim() !== "") {
        return adviceContainer.textContent.trim().substring(0, 200) + (adviceContainer.textContent.length > 200 ? '...' : '');
    }
    return ResultsManager.generateAdviceSummaryText(appState.results); // 修正: ResultsManagerのメソッドを利用
},

downloadExportData(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `生涯収支シミュレーション結果_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    NotificationManager.show('結果をJSONファイルとしてエクスポートしました', 'success');
}

};
if (typeof window !== 'undefined') {
    window.debugAppState = () => console.log('Current App State:', JSON.parse(JSON.stringify(appState)));
    window.forceStep = (stepNumber) => {
        if (stepNumber > 0 && stepNumber <= 5) {
            appState.currentStep = stepNumber;
            appState.farthestValidatedStep = Math.max(appState.farthestValidatedStep, stepNumber);
            UIManager.showStep(stepNumber);
            console.log(`Forced to step ${stepNumber}`); // 修正点: バッククォートに変更
        }
    };
    // 他のデバッグ関数もここに追加される可能性があります
    window.clearLocalStorage = () => { StorageManager.clear(); console.log('Local storage cleared'); };
    window.simulateCalculation = () => CalculationEngine.calculate();
}
document.addEventListener('DOMContentLoaded', () => { // 修正: function() を削除
AppInitializer.init().catch(error => {
console.error('Failed to initialize application:', error);
NotificationManager.show('アプリケーションの初期化に失敗しました', 'error');
});
});
if (typeof module !== 'undefined' && module.exports) {
module.exports = { NavigationManager, AppInitializer };
}