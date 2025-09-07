/**
 * 生涯収支シミュレーター - 基本マネージャー
 * 通知、バリデーション、ストレージ、UI、フォーム管理システム
 */

// ===== 通知管理システム =====
const NotificationManager = {
    show(message, type = 'info', duration = APP_CONFIG.NOTIFICATION_DURATION) {
        const id = `notification_${currentNotificationId++}`;
        const notification = this.createElement(message, type, id);
        
        document.body.appendChild(notification);
        
        // アニメーション用のクラスを追加
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // 自動削除
        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }
        
        this.repositionNotifications();
        
        return id;
    },

    createElement(message, type, id) {
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `notification notification-${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon" aria-hidden="true">
                    ${this.getIcon(type)}
                </span>
                <span class="notification-message">${Utils.sanitizeHtml(message)}</span>
                <button class="notification-close" aria-label="閉じる" onclick="NotificationManager.remove('${id}')">
                    ×
                </button>
            </div>
        `;
        
        return notification;
    },

    getIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || icons.info;
    },

    remove(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.repositionNotifications();
            }, APP_CONFIG.ANIMATION_DURATION);
        }
    },

    repositionNotifications() {
        const notifications = document.querySelectorAll('.notification.show');
        notifications.forEach((notification, index) => {
            notification.style.transform = `translateY(${index * 80}px)`;
        });
    }
};

// ===== フォーム検証システム =====
const ValidationManager = {
    rules: new Map(),
    
    addRule(fieldId, validator, message) {
        if (!this.rules.has(fieldId)) {
            this.rules.set(fieldId, []);
        }
        this.rules.get(fieldId).push({ validator, message });
    },

    validate(fieldId, value) {
        const fieldRules = this.rules.get(fieldId);
        if (!fieldRules) return { isValid: true, errors: [] };
        
        const errors = [];
        for (const rule of fieldRules) {
            if (!rule.validator(value)) {
                errors.push(rule.message);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    },

    validateAll() {
        const errors = new Map();
        
        for (const [fieldId, _] of this.rules) {
            const element = Utils.getElement(fieldId, false);
            if (element) {
                const result = this.validate(fieldId, element.value);
                if (!result.isValid) {
                    errors.set(fieldId, result.errors[0]);
                }
            }
        }
        
        return errors;
    },

    setupValidationRules() {
        // 基本情報の検証ルール
        this.addRule('income', 
            value => {
                const num = Utils.parseNumber(value);
                return num >= 5 && num <= 300;
            },
            '手取り収入を5〜300万円の範囲で入力してください'
        );

        this.addRule('retirementAge',
            value => {
                const num = Utils.parseInt(value);
                return num >= 55 && num <= 75;
            },
            'リタイア希望年齢を55〜75歳で入力してください'
        );

        this.addRule('expectedLifeExpectancy',
            value => {
                const num = Utils.parseInt(value);
                return num >= 80 && num <= 100;
            },
            '想定寿命を80〜100歳で入力してください'
        );

        this.addRule('investmentReturnRate',
            value => {
                const num = Utils.parseNumber(value);
                return num >= 0 && num <= 15;
            },
            '期待運用利回りを0〜15%で入力してください'
        );
    }
};

// ===== ローカルストレージ管理 =====
const StorageManager = {
    save(data) {
        try {
            const dataToSave = {
                version: APP_CONFIG.VERSION,
                timestamp: new Date().toISOString(),
                data: data
            };
            
            localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(dataToSave));
            return true;
        } catch (error) {
            Utils.handleError(error, 'Data save');
            return false;
        }
    },

    load() {
        try {
            const stored = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
            if (!stored) return null;
            
            const parsed = JSON.parse(stored);
            
            // バージョンチェック
            if (parsed.version !== APP_CONFIG.VERSION) {
                console.log('Data version mismatch, migrating...');
                return this.migrateData(parsed.data);
            }
            
            return parsed.data;
        } catch (error) {
            Utils.handleError(error, 'Data load');
            return null;
        }
    },

    clear() {
        try {
            localStorage.removeItem(APP_CONFIG.STORAGE_KEY);
            return true;
        } catch (error) {
            Utils.handleError(error, 'Data clear');
            return false;
        }
    },

    migrateData(oldData) {
        try {
            // データ移行ロジック（将来のバージョン用）
            console.log('Migrating data from older version...');
            
            // 基本的な構造チェックと補完
            const migratedData = {
                currentStep: oldData.currentStep || 1,
                farthestValidatedStep: oldData.farthestValidatedStep || 1,
                basicInfo: {
                    ...APP_DATA.defaultAdvancedSettings,
                    ...oldData.basicInfo
                },
                fixedCosts: oldData.fixedCosts || {},
                lifeEvents: oldData.lifeEvents || {},
                customLifeEvents: oldData.customLifeEvents || [],
                detailSettings: {
                    childrenCount: 1,
                    housingAge: 35,
                    nisaAmount: 3.3,
                    ...oldData.detailSettings
                },
                advancedSettings: {
                    ...APP_DATA.defaultAdvancedSettings,
                    ...oldData.advancedSettings
                },
                results: oldData.results || {},
                validationErrors: new Map(),
                isCalculating: false
            };
            
            return migratedData;
        } catch (error) {
            Utils.handleError(error, 'Data migration');
            return null;
        }
    },

    export() {
        const data = this.load();
        if (!data) {
            throw new Error('エクスポートするデータがありません');
        }
        
        return {
            exportDate: new Date().toISOString(),
            appVersion: APP_CONFIG.VERSION,
            data: data
        };
    }
};

// ===== UI管理システム =====
const UIManager = {
    // 進捗更新
    updateProgress() {
        const progressBar = Utils.getElement('progressBar', false);
        const progressText = Utils.getElement('progressText', false);
        
        if (progressBar && progressText) {
            const progress = (appState.currentStep / 5) * 100;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `ステップ ${appState.currentStep} / 5`;
        }
    },

    // ステップラベル更新
    updateStepLabels() {
        document.querySelectorAll('.step-label').forEach((label, index) => {
            const stepNumber = index + 1;
            
            label.classList.remove('completed', 'current', 'accessible');
            
            if (stepNumber < appState.currentStep) {
                label.classList.add('completed');
            } else if (stepNumber === appState.currentStep) {
                label.classList.add('current');
            }
            
            if (stepNumber <= appState.farthestValidatedStep) {
                label.classList.add('accessible');
            }
        });
    },

    // ステップ表示切り替え
    showStep(stepNumber) {
        // 全ステップを非表示
        document.querySelectorAll('.step-content').forEach(step => {
            step.style.display = 'none';
        });
        
        // 指定ステップを表示
        const targetStep = Utils.getElement(`step${stepNumber}`, false);
        if (targetStep) {
            targetStep.style.display = 'block';
        }
        
        // 進捗とラベル更新
        this.updateProgress();
        this.updateStepLabels();
        
        // ナビゲーションボタン更新
        this.updateNavigationButtons(stepNumber);
        
        // フォーカス設定
        this.setStepFocus(stepNumber);
    },

    // ナビゲーションボタン更新
    updateNavigationButtons(stepNumber) {
        const prevBtn = Utils.getElement('prevStepBtn', false);
        const nextBtn = Utils.getElement('nextStepBtn', false);
        const calculateBtn = Utils.getElement('calculateBtn', false);
        
        if (prevBtn) {
            prevBtn.style.display = stepNumber > 1 ? 'inline-flex' : 'none';
        }
        
        if (nextBtn) {
            nextBtn.style.display = stepNumber < 5 ? 'inline-flex' : 'none';
        }
        
        if (calculateBtn) {
            calculateBtn.style.display = stepNumber === 5 ? 'inline-flex' : 'none';
        }
    },

    // ステップフォーカス設定
    setStepFocus(stepNumber) {
        const stepElement = Utils.getElement(`step${stepNumber}`, false);
        if (stepElement) {
            const firstInput = stepElement.querySelector('input, select, button');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    },

    // エラー表示
    showError(elementId, message) {
        const element = Utils.getElement(elementId, false);
        if (!element) return;
        
        element.classList.add('error');
        element.setAttribute('aria-invalid', 'true');
        
        const errorId = `${elementId}Error`;
        let errorElement = Utils.getElement(errorId, false);
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = errorId;
            errorElement.className = 'input-error-message';
            errorElement.setAttribute('role', 'alert');
            element.parentNode.insertBefore(errorElement, element.nextSibling);
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        element.setAttribute('aria-describedby', errorId);
    },

    // エラー解除
    clearError(elementId) {
        const element = Utils.getElement(elementId, false);
        if (!element) return;
        
        element.classList.remove('error');
        element.removeAttribute('aria-invalid');
        element.removeAttribute('aria-describedby');
        
        const errorElement = Utils.getElement(`${elementId}Error`, false);
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    },

    // ローディング表示
    showLoading() {
        const loadingContainer = Utils.getElement('loadingContainer', false);
        if (loadingContainer) {
            loadingContainer.style.display = 'flex';
            
            // ローディングアニメーション開始
            this.animateLoadingSteps();
        }
    },

    // ローディング非表示
    hideLoading() {
        const loadingContainer = Utils.getElement('loadingContainer', false);
        if (loadingContainer) {
            loadingContainer.style.display = 'none';
        }
    },

    // ローディングステップアニメーション
    animateLoadingSteps() {
        const steps = document.querySelectorAll('.loading-step');
        if (steps.length === 0) return;
        
        steps.forEach((step, index) => {
            setTimeout(() => {
                step.classList.add('active');
                setTimeout(() => {
                    step.classList.remove('active');
                }, 800);
            }, index * 400);
        });
        
        // アニメーションをループ
        setTimeout(() => {
            if (Utils.getElement('loadingContainer', false)?.style.display !== 'none') {
                this.animateLoadingSteps();
            }
        }, steps.length * 400 + 1000);
    },

    // プレースホルダー表示制御
    updatePlaceholders(showResults = false) {
        const placeholders = document.querySelectorAll('.results-placeholder');
        const resultsContent = document.querySelectorAll('.results-content');
        
        placeholders.forEach(placeholder => {
            placeholder.style.display = showResults ? 'none' : 'block';
        });
        
        resultsContent.forEach(content => {
            content.style.display = showResults ? 'block' : 'none';
        });
    }
};

// ===== フォーム管理システム =====
const FormManager = {
    // 誕生日セレクト設定
    setupBirthdaySelects() {
        const currentYear = new Date().getFullYear();
        const yearSelect = Utils.getElement('birthYear', false);
        const monthSelect = Utils.getElement('birthMonth', false);

        if (yearSelect) {
            yearSelect.innerHTML = '<option value="">年</option>';
            for (let year = currentYear - 80; year <= currentYear - 18; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = `${year}年`;
                yearSelect.appendChild(option);
            }
        }

        if (monthSelect) {
            monthSelect.innerHTML = '<option value="">月</option>';
            for (let month = 1; month <= 12; month++) {
                const option = document.createElement('option');
                option.value = month;
                option.textContent = `${month}月`;
                monthSelect.appendChild(option);
            }
        }

        // 年・月変更時の誕生日値更新
        [yearSelect, monthSelect].forEach(select => {
            if (select) {
                select.addEventListener('change', () => {
                    this.updateBirthdayValue();
                });
            }
        });
    },

    // 誕生日値更新（日は15日固定）
    updateBirthdayValue() {
        const yearSelect = Utils.getElement('birthYear', false);
        const monthSelect = Utils.getElement('birthMonth', false);
        
        if (!yearSelect || !monthSelect) return;
        
        const year = yearSelect.value;
        const month = monthSelect.value;
        
        if (year && month) {
            // 日は15日固定（要件定義書通り）
            const birthday = `${year}-${month.padStart(2, '0')}-15`;
            appState.basicInfo.birthday = birthday;
            
            // 年齢表示更新
            this.updateAgeDisplay();
            
            // 年金設定調整
            const age = Utils.calculateAge(birthday);
            if (age !== null && window.PensionManager) {
                PensionManager.adjustByAge(age);
            }
            
            // エラークリア
            UIManager.clearError('birthYear');
            
            // 自動保存
            this.autoSave();
        }
    },

    // 年齢表示更新
    updateAgeDisplay() {
        const ageDisplay = Utils.getElement('ageDisplay', false);
        const currentAgeElement = Utils.getElement('currentAge', false);
        
        if (!ageDisplay) return;
        
        if (appState.basicInfo.birthday) {
            const age = Utils.calculateAge(appState.basicInfo.birthday);
            if (age !== null) {
                if (currentAgeElement) {
                    currentAgeElement.textContent = age;
                }
                ageDisplay.style.display = 'block';
            } else {
                ageDisplay.style.display = 'none';
            }
        } else {
            ageDisplay.style.display = 'none';
        }
    },

    // フォームデータ復元
    restoreFormData() {
        try {
            // 誕生日の復元
            if (appState.basicInfo.birthday) {
                const date = new Date(appState.basicInfo.birthday);
                const yearSelect = Utils.getElement('birthYear', false);
                const monthSelect = Utils.getElement('birthMonth', false);

                if (yearSelect) yearSelect.value = date.getFullYear();
                if (monthSelect) monthSelect.value = date.getMonth() + 1;
                
                this.updateAgeDisplay();
            }

            // 基本情報の復元
            const basicFields = ['income', 'occupation'];
            basicFields.forEach(fieldId => {
                const element = Utils.getElement(fieldId, false);
                if (element && appState.basicInfo[fieldId] !== undefined) {
                    element.value = appState.basicInfo[fieldId];
                }
            });

            // 年金フィールドの復元
            this.restorePensionFields();

            // 詳細設定の復元
            Object.keys(appState.advancedSettings).forEach(key => {
                const element = Utils.getElement(key, false);
                if (element && appState.advancedSettings[key] !== undefined) {
                    element.value = appState.advancedSettings[key];
                }
            });

            // ライフイベント詳細設定の復元
            if (appState.detailSettings.childrenCount !== undefined) {
                const element = Utils.getElement('childrenCount', false);
                if (element) element.value = appState.detailSettings.childrenCount;
            }

            if (appState.detailSettings.housingAge !== undefined) {
                const element = Utils.getElement('housingAge', false);
                if (element) element.value = appState.detailSettings.housingAge;
            }

            if (appState.detailSettings.nisaAmount !== undefined) {
                const element = Utils.getElement('nisaAmount', false);
                if (element) element.value = appState.detailSettings.nisaAmount;
            }

            console.log('Form data restored successfully');
            
        } catch (error) {
            Utils.handleError(error, 'Form data restoration');
        }
    },

    // 年金フィールドの復元
    restorePensionFields() {
        const pensionFields = [
            'nationalPension実績Years', 'nationalPension予定Years',
            'employeePension実績Years', 'employeePension予定Years'
        ];

        pensionFields.forEach(fieldId => {
            const value = appState.basicInfo[fieldId];
            if (value !== undefined) {
                const input = Utils.getElement(fieldId, false);
                const slider = Utils.getElement(fieldId.replace('Years', 'Slider'), false);
                
                if (input) input.value = value;
                if (slider) slider.value = value;
            }
        });

        // 年金計算を実行
        setTimeout(() => {
            if (window.PensionManager) {
                PensionManager.calculate();
            }
        }, 100);
    },

    // 自動保存
    autoSave() {
        Utils.debounce('autoSave', () => {
            StorageManager.save(appState);
        }, 500);
    },

    // フォームの状態保存
    saveCurrentStepData() {
        switch (appState.currentStep) {
            case 1:
                this.saveBasicInfo();
                break;
            case 2:
                this.saveFixedCosts();
                break;
            case 3:
                this.saveLifeEvents();
                break;
            case 4:
                this.saveAdvancedSettings();
                break;
        }
    },

    // 基本情報保存
    saveBasicInfo() {
        appState.basicInfo.income = Utils.parseNumber(Utils.getElement('income')?.value, null, 5, 300);
        appState.basicInfo.occupation = Utils.getElement('occupation')?.value || '';
        appState.basicInfo.nationalPension実績Years = Utils.parseInt(Utils.getElement('nationalPension実績Years')?.value, 0, 0, 40);
        appState.basicInfo.nationalPension予定Years = Utils.parseInt(Utils.getElement('nationalPension予定Years')?.value, 20, 0, 40);
        appState.basicInfo.employeePension実績Years = Utils.parseInt(Utils.getElement('employeePension実績Years')?.value, 0, 0, 52);
        appState.basicInfo.employeePension予定Years = Utils.parseInt(Utils.getElement('employeePension予定Years')?.value, 20, 0, 52);
    },

    // 固定費保存
    saveFixedCosts() {
        // FixedCostManagerで既に保存されているので、特別な処理は不要
    },

    // ライフイベント保存
    saveLifeEvents() {
        if (appState.lifeEvents.children) {
            const childrenCountInput = Utils.getElement('childrenCount', false);
            if (childrenCountInput) {
                appState.detailSettings.childrenCount = Utils.parseInt(childrenCountInput.value, 1, 0, 10);
            }
        }

        if (appState.lifeEvents.housing) {
            const housingAgeInput = Utils.getElement('housingAge', false);
            if (housingAgeInput) {
                appState.detailSettings.housingAge = Utils.parseInt(housingAgeInput.value, 35, 20, 70);
            }
        }

        if (appState.lifeEvents.nisa) {
            const nisaAmountInput = Utils.getElement('nisaAmount', false);
            if (nisaAmountInput) {
                appState.detailSettings.nisaAmount = Utils.parseNumber(nisaAmountInput.value, 3.3, 0.1, 30);
            }
        }
    },

    // 詳細設定保存
    saveAdvancedSettings() {
        const retirementAgeInput = Utils.getElement('retirementAge', false);
        const expectedLifeExpectancyInput = Utils.getElement('expectedLifeExpectancy', false);
        const investmentReturnRateInput = Utils.getElement('investmentReturnRate', false);

        if (retirementAgeInput) {
            appState.advancedSettings.retirementAge = Utils.parseInt(retirementAgeInput.value, 65, 55, 75);
        }

        if (expectedLifeExpectancyInput) {
            appState.advancedSettings.expectedLifeExpectancy = Utils.parseInt(expectedLifeExpectancyInput.value, 95, 80, 100);
        }

        if (investmentReturnRateInput) {
            appState.advancedSettings.investmentReturnRate = Utils.parseNumber(investmentReturnRateInput.value, 3.0, 0, 15);
        }
    }
};

// モジュールエクスポート（必要に応じて）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NotificationManager,
        ValidationManager,
        StorageManager,
        UIManager,
        FormManager
    };
}