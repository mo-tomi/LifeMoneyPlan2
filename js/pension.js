/**
 * 生涯収支シミュレーター - 年金管理システム
 * 年金計算、フィールド管理、ガイダンス表示
 */

// ===== 年金管理システム =====
const PensionManager = {
    // 年齢に基づく年金設定調整
    adjustByAge(age) {
        const retirementAge = Utils.parseInt(Utils.getElement('retirementAge')?.value, 65, 55, 75);
        const occupation = Utils.getElement('occupation')?.value || '';
        
        // 国民年金の調整
        this.adjustNationalPension(age);
        
        // 厚生年金の調整
        this.adjustEmployeePension(age, retirementAge, occupation);
        
        // 年金概算計算
        this.calculate();
    },

    // 国民年金調整
    adjustNationalPension(age) {
        const maxYears = 40;
        const maxAgeForHistory = Math.max(0, Math.min(maxYears, age - 20));
        const maxAgeForFuture = Math.max(0, Math.min(60 - age, maxYears - appState.basicInfo.nationalPension実績Years));

        this.updatePensionField('nationalPension実績', maxAgeForHistory, appState.basicInfo.nationalPension実績Years);
        this.updatePensionField('nationalPension予定', maxAgeForFuture, appState.basicInfo.nationalPension予定Years);
        
        this.updateGuidance('nationalPension', 
            appState.basicInfo.nationalPension実績Years, 
            appState.basicInfo.nationalPension予定Years, 
            maxYears, maxAgeForHistory, maxAgeForFuture);
    },

    // 厚生年金調整
    adjustEmployeePension(age, retirementAge, occupation) {
        const maxYears = 52;
        const maxAgeForHistory = Math.max(0, Math.min(maxYears, age - 18));
        const remainingYears = Math.max(0, retirementAge - age);
        const maxAgeForFuture = Math.min(remainingYears, maxYears - appState.basicInfo.employeePension実績Years);

        // 職業に基づく初期値設定
        let defaultFutureYears = appState.basicInfo.employeePension予定Years;
        const isEmployeeLike = occupation === 'employee' || occupation === 'civil_servant';
        
        if (defaultFutureYears === undefined || defaultFutureYears === null) {
            defaultFutureYears = isEmployeeLike ? maxAgeForFuture : 0;
        }

        this.updatePensionField('employeePension実績', maxAgeForHistory, appState.basicInfo.employeePension実績Years);
        this.updatePensionField('employeePension予定', maxAgeForFuture, defaultFutureYears);
        
        this.updateGuidance('employeePension', 
            appState.basicInfo.employeePension実績Years, 
            appState.basicInfo.employeePension予定Years, 
            maxYears, maxAgeForHistory, maxAgeForFuture);
    },

    // 年金フィールド更新
    updatePensionField(type, maxValue, currentValue) {
        const inputId = `${type}Years`;
        const sliderId = `${type}Slider`;
        const maxLabelId = `${type}SliderMaxLabel`;

        const input = Utils.getElement(inputId, false);
        const slider = Utils.getElement(sliderId, false);
        const maxLabel = Utils.getElement(maxLabelId, false);

        if (input) {
            input.max = maxValue;
            input.value = Math.min(currentValue, maxValue);
        }

        if (slider) {
            slider.max = maxValue;
            slider.value = Math.min(currentValue, maxValue);
        }

        if (maxLabel) {
            maxLabel.textContent = `${maxValue}年`;
        }

        // ステッパーボタンの状態更新
        this.updateStepperButtons(inputId, Math.min(currentValue, maxValue), maxValue);

        // appStateの更新
        const fieldKey = `${type}Years`;
        if (appState.basicInfo.hasOwnProperty(fieldKey)) {
            appState.basicInfo[fieldKey] = Math.min(currentValue, maxValue);
        }
    },

    // ステッパーボタン状態更新
    updateStepperButtons(inputId, currentValue, maxValue) {
        const decrementBtn = Utils.getElement(`${inputId}Decrement`, false);
        const incrementBtn = Utils.getElement(`${inputId}Increment`, false);

        if (decrementBtn) {
            decrementBtn.disabled = currentValue <= 0;
        }

        if (incrementBtn) {
            incrementBtn.disabled = currentValue >= maxValue;
        }
    },

    // ガイダンス更新
    updateGuidance(pensionType, historyYears, futureYears, maxYears, maxHistory, maxFuture) {
        const guidanceId = `${pensionType}Guidance`;
        const guidanceElement = Utils.getElement(guidanceId, false);
        
        if (!guidanceElement) return;

        const totalYears = historyYears + futureYears;
        let message = '';
        let className = 'pension-guidance-message';

        if (totalYears === 0) {
            message = `${pensionType === 'nationalPension' ? '国民年金' : '厚生年金'}の加入予定がありません。`;
            className += ' warning';
        } else if (totalYears > maxYears) {
            message = `合計が${maxYears}年を超えています（現在：${totalYears}年）。調整してください。`;
            className += ' error';
        } else if (pensionType === 'nationalPension' && totalYears < 25) {
            message = `加入期間が${totalYears}年です。25年未満の場合、年金を受給できない可能性があります。`;
            className += ' warning';
        } else if (totalYears === maxYears) {
            message = `満額の年金が期待できます（${totalYears}年）。`;
            className += ' success';
        } else {
            const ratio = (totalYears / maxYears * 100).toFixed(0);
            message = `加入期間：${totalYears}年（満額の${ratio}%）`;
            className += ' info';
        }

        guidanceElement.textContent = message;
        guidanceElement.className = className;
        guidanceElement.style.display = 'block';
    },

    // 年金概算計算
    calculate() {
        const income = Utils.parseNumber(Utils.getElement('income')?.value, 0);
        const npHistory = appState.basicInfo.nationalPension実績Years || 0;
        const npFuture = appState.basicInfo.nationalPension予定Years || 0;
        const epHistory = appState.basicInfo.employeePension実績Years || 0;
        const epFuture = appState.basicInfo.employeePension予定Years || 0;

        const totalNationalPensionYears = npHistory + npFuture;
        const totalEmployeePensionYears = epHistory + epFuture;

        const pensionEstimate = Utils.getElement('pensionEstimate');
        
        if (income <= 0 && totalNationalPensionYears <= 0 && totalEmployeePensionYears <= 0) {
            if (pensionEstimate) pensionEstimate.style.display = 'none';
            return;
        }

        // 国民年金計算
        const nationalPensionFullAnnual = 816000;
        const nationalPensionMonthly = (nationalPensionFullAnnual * (Math.min(totalNationalPensionYears, 40) / 40)) / 12;

        // 厚生年金計算
        let employeePensionMonthly = 0;
        if (totalEmployeePensionYears > 0 && income > 0) {
            const estimatedGrossMonthlySalary = income * 10000 * 1.35;
            const averageStandardReward = Math.min(Math.max(estimatedGrossMonthlySalary, 88000), 650000);
            employeePensionMonthly = (averageStandardReward * (5.481 / 1000) * (totalEmployeePensionYears * 12)) / 12;
            employeePensionMonthly = Math.max(0, employeePensionMonthly);
        }

        const totalPensionMonthly = nationalPensionMonthly + employeePensionMonthly;

        // 結果表示
        this.displayPensionResults(nationalPensionMonthly, employeePensionMonthly, totalPensionMonthly);
    },

    // 年金結果表示
    displayPensionResults(national, employee, total) {
        const nationalElement = Utils.getElement('nationalPensionAmount', false);
        const employeeElement = Utils.getElement('employeePensionAmount', false);
        const totalElement = Utils.getElement('totalPensionAmount', false);
        const estimateElement = Utils.getElement('pensionEstimate', false);

        if (nationalElement) {
            nationalElement.textContent = `${Math.round(national).toLocaleString()}円`;
        }

        if (employeeElement) {
            employeeElement.textContent = `${Math.round(employee).toLocaleString()}円`;
        }

        if (totalElement) {
            totalElement.textContent = `${Math.round(total).toLocaleString()}円`;
        }

        if (estimateElement) {
            estimateElement.style.display = 'block';
        }
    },

    // 年金入力フィールド設定
    setupInputs() {
        const pensionFields = [
            { type: 'nationalPension', period: '実績' },
            { type: 'nationalPension', period: '予定' },
            { type: 'employeePension', period: '実績' },
            { type: 'employeePension', period: '予定' }
        ];

        pensionFields.forEach(field => {
            const sliderId = `${field.type}${field.period}Slider`;
            const inputId = `${field.type}${field.period}Years`;
            
            this.setupSliderInput(sliderId, inputId, field);
        });

        this.setupSteppers();
    },

    // スライダー入力設定
    setupSliderInput(sliderId, inputId, field) {
        const slider = Utils.getElement(sliderId, false);
        const input = Utils.getElement(inputId, false);

        if (!slider || !input) return;

        const updateValue = (value) => {
            const numValue = Utils.parseInt(value, 0, 0, parseInt(slider.max));
            slider.value = numValue;
            input.value = numValue;
            
            const fieldKey = `${field.type}${field.period}Years`;
            appState.basicInfo[fieldKey] = numValue;
            
            this.calculate();
            FormManager.autoSave();
            UIManager.clearError(inputId);
        };

        slider.addEventListener('input', (e) => {
            updateValue(e.target.value);
        });

        input.addEventListener('input', (e) => {
            Utils.debounce(`pension_${inputId}`, () => {
                updateValue(e.target.value);
            });
        });
    },

    // ステッパー設定
    setupSteppers() {
        const stepperFields = [
            'nationalPension実績Years', 'nationalPension予定Years',
            'employeePension実績Years', 'employeePension予定Years'
        ];

        stepperFields.forEach(fieldId => {
            this.setupStepperField(fieldId);
        });
    },

    // 個別ステッパーフィールド設定
    setupStepperField(fieldId) {
        const input = Utils.getElement(fieldId, false);
        const decrementBtn = Utils.getElement(`${fieldId}Decrement`, false);
        const incrementBtn = Utils.getElement(`${fieldId}Increment`, false);

        if (!input) return;

        const updateValue = (change) => {
            const currentValue = Utils.parseInt(input.value, 0);
            const maxValue = Utils.parseInt(input.max, 100);
            const newValue = Utils.clamp(currentValue + change, 0, maxValue);
            
            input.value = newValue;
            const slider = Utils.getElement(fieldId.replace('Years', 'Slider'), false);
            if (slider) slider.value = newValue;
            
            appState.basicInfo[fieldId] = newValue;
            
            this.updateStepperButtons(fieldId, newValue, maxValue);
            this.calculate();
            FormManager.autoSave();
        };

        if (decrementBtn) {
            decrementBtn.addEventListener('click', () => updateValue(-1));
        }

        if (incrementBtn) {
            incrementBtn.addEventListener('click', () => updateValue(1));
        }

        // キーボードナビゲーション
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                updateValue(1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                updateValue(-1);
            }
        });
    },

    // 計算用年金額取得（万円単位）
    getPensionAmount() {
        const { income, nationalPension実績Years, nationalPension予定Years, employeePension実績Years, employeePension予定Years } = appState.basicInfo;
        
        const totalNpYears = nationalPension実績Years + nationalPension予定Years;
        const totalEpYears = employeePension実績Years + employeePension予定Years;

        // 国民年金
        const nationalPensionFullAnnual = 816000;
        const npMonthly = (nationalPensionFullAnnual * (Math.min(totalNpYears, 40) / 40)) / 12;

        // 厚生年金
        let epMonthly = 0;
        if (totalEpYears > 0 && income > 0) {
            const estimatedGrossMonthlySalary = income * 10000 * 1.35;
            const averageStandardReward = Math.min(Math.max(estimatedGrossMonthlySalary, 88000), 650000);
            const annualBenefit = averageStandardReward * (5.481 / 1000) * (totalEpYears * 12);
            epMonthly = Math.max(0, annualBenefit / 12);
        }

        return (npMonthly + epMonthly) / 10000; // 万円単位に変換
    },

    // 年金詳細情報の生成
    generatePensionDetails() {
        const { income, nationalPension実績Years, nationalPension予定Years, employeePension実績Years, employeePension予定Years } = appState.basicInfo;
        
        const totalNpYears = nationalPension実績Years + nationalPension予定Years;
        const totalEpYears = employeePension実績Years + employeePension予定Years;

        return {
            nationalPension: {
                years: totalNpYears,
                maxYears: 40,
                ratio: Math.min(totalNpYears / 40, 1),
                monthlyAmount: this.calculateNationalPensionAmount(totalNpYears)
            },
            employeePension: {
                years: totalEpYears,
                maxYears: 52,
                monthlyAmount: this.calculateEmployeePensionAmount(totalEpYears, income)
            },
            totalMonthlyAmount: this.getPensionAmount() * 10000
        };
    },

    // 国民年金額計算
    calculateNationalPensionAmount(years) {
        const nationalPensionFullAnnual = 816000;
        return (nationalPensionFullAnnual * (Math.min(years, 40) / 40)) / 12;
    },

    // 厚生年金額計算
    calculateEmployeePensionAmount(years, income) {
        if (years <= 0 || !income || income <= 0) return 0;
        
        const estimatedGrossMonthlySalary = income * 10000 * 1.35;
        const averageStandardReward = Math.min(Math.max(estimatedGrossMonthlySalary, 88000), 650000);
        const annualBenefit = averageStandardReward * (5.481 / 1000) * (years * 12);
        return Math.max(0, annualBenefit / 12);
    },

    // 年金アドバイス生成
    generateAdvice() {
        const pensionDetails = this.generatePensionDetails();
        const advice = [];

        // 国民年金のアドバイス
        if (pensionDetails.nationalPension.years < 25) {
            advice.push({
                type: 'warning',
                title: '国民年金の受給資格について',
                message: `現在の加入期間（${pensionDetails.nationalPension.years}年）では年金を受給できません。25年以上の加入が必要です。`
            });
        } else if (pensionDetails.nationalPension.years < 40) {
            advice.push({
                type: 'info',
                title: '国民年金の増額可能性',
                message: `現在の加入期間は${pensionDetails.nationalPension.years}年です。60歳以降も任意加入することで年金額を増やせます。`
            });
        }

        // 厚生年金のアドバイス
        if (pensionDetails.employeePension.years > 0) {
            advice.push({
                type: 'success',
                title: '厚生年金について',
                message: `厚生年金の加入期間が${pensionDetails.employeePension.years}年予定です。年金額の大幅な増額が期待できます。`
            });
        } else {
            advice.push({
                type: 'info',
                title: '厚生年金未加入について',
                message: '厚生年金への加入予定がありません。可能であれば厚生年金への加入を検討することで、将来の年金額を大幅に増やせます。'
            });
        }

        return advice;
    },

    // 年金情報のエクスポート
    exportData() {
        const pensionDetails = this.generatePensionDetails();
        
        return {
            基本情報: {
                国民年金実績: `${appState.basicInfo.nationalPension実績Years}年`,
                国民年金予定: `${appState.basicInfo.nationalPension予定Years}年`,
                厚生年金実績: `${appState.basicInfo.employeePension実績Years}年`,
                厚生年金予定: `${appState.basicInfo.employeePension予定Years}年`
            },
            計算結果: {
                国民年金月額: `${Math.round(pensionDetails.nationalPension.monthlyAmount).toLocaleString()}円`,
                厚生年金月額: `${Math.round(pensionDetails.employeePension.monthlyAmount).toLocaleString()}円`,
                合計月額: `${Math.round(pensionDetails.totalMonthlyAmount).toLocaleString()}円`
            },
            アドバイス: this.generateAdvice()
        };
    }
};

// モジュールエクスポート（必要に応じて）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PensionManager
    };
}
