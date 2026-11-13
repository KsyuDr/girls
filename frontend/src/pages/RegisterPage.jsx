import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Siren,
  Bell,
  Map,
  Phone,
  MapPin,
  ChevronDown,
  LocateFixed,
} from 'lucide-react';
import { CITIES } from '../mock/data';
import { USE_MOCK, registerUser, loginUser, verifyCode } from '../services/api';
import { formatPhone } from '../services/adapters';
import './RegisterPage.css';

export default function RegisterPage({
  initialUser,
  isAuthenticated = false,
  canBrowse = false,
  onSuccess,
  onGoToLogin,
  onGoHome,
  onLogout,
}) {
  // 'register' — новая анкета, 'login' — только номер (имя и город у существующего аккаунта уже есть)
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState(initialUser?.city || 'Москва');
  const [geolocationEnabled, setGeolocationEnabled] = useState(
    initialUser?.geolocationEnabled ?? true
  );
  const [activeField, setActiveField] = useState('phone');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Шаг 2 из 2: ввод кода из SMS (с реальным бэкендом; в режиме моков шаг пропускается)
  const [step, setStep] = useState('form');
  const [sentPhone, setSentPhone] = useState('');
  const [code, setCode] = useState('');
  // Новый код можно запросить не раньше чем через минуту (так считает и сервер)
  const [resendIn, setResendIn] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState('');

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Запрос кода: вход — по номеру, регистрация — анкетой
  const requestCode = (targetPhone, asMode = mode) =>
    asMode === 'login'
      ? loginUser(targetPhone)
      : registerUser({ name, phone: targetPhone, city, geolocationEnabled });

  const handleResend = async () => {
    setResending(true);
    setResendNote('');
    setErrors({});
    try {
      await requestCode(sentPhone);
      setCode('');
      setResendIn(60);
      setResendNote('Новый код отправлен');
    } catch (error) {
      const wait = Number(error?.retryAfter) || 0;
      if (wait > 0) setResendIn(wait);
      setErrors({ code: error.message });
    } finally {
      setResending(false);
    }
  };

  const validateField = (field, value) => {
    if (field === 'name') {
      if (!value.trim()) return 'Пожалуйста, укажите ваше имя';
    }
    if (field === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10) return 'Введите корректный номер телефона';
    }
    return '';
  };

  const handleBlur = (field, value) => {
    const errorMsg = validateField(field, value);
    if (errorMsg) {
      setErrors((prev) => ({ ...prev, [field]: errorMsg }));
    }
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: '' }));
    }
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setPhone(val);
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: '' }));
    }
  };

  const handleVerify = async () => {
    if (!/^\d{4,6}$/.test(code.trim())) {
      setErrors({ code: 'Введите код из SMS — от 4 до 6 цифр' });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await verifyCode(sentPhone, code);
      onSuccess?.(result.user);
    } catch (error) {
      setErrors({ code: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 'code') {
      await handleVerify();
      return;
    }
    const nameError = mode === 'register' ? validateField('name', name) : '';
    const phoneError = validateField('phone', phone);

    if (nameError || phoneError) {
      setErrors({ name: nameError, phone: phoneError });
      return;
    }

    await sendCode(mode);
  };

  // asMode — 'login', когда номер уже зарегистрирован и человек согласился войти
  const sendCode = async (asMode) => {
    setIsSubmitting(true);
    try {
      const result = await requestCode(phone, asMode);
      if (asMode !== mode) setMode(asMode);
      if (result.user) {
        onSuccess?.(result.user);
      } else {
        setSentPhone(result.phone || phone);
        setCode('');
        setErrors({});
        setResendNote('');
        setResendIn(60);
        setStep('code');
      }
    } catch (error) {
      if (error?.status === 409 && asMode === 'register') {
        setErrors({
          form: 'Этот номер уже зарегистрирован. Войдите по нему — имя и город в аккаунте останутся прежними.',
          formAction: 'login',
        });
      } else {
        setErrors({ form: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reg-page" data-node-id="3149:14">
      {/* Левая панель Hero (Десктоп MacBook Pro 14") */}
      <aside className="reg-hero" data-node-id="3149:61">
        <div className="reg-hero__ellipse reg-hero__ellipse--top" aria-hidden="true" />
        <div className="reg-hero__ellipse reg-hero__ellipse--bottom" aria-hidden="true" />

        {/* Логотип ведёт на главную, если её уже можно открыть (данные загружены) */}
        <button
          type="button"
          className="reg-hero__brand"
          onClick={() => canBrowse && onGoHome?.()}
          disabled={!canBrowse}
          aria-label="Безопасный город — на главную"
          data-node-id="3149:21"
        >
          <span className="reg-hero__logo-box" data-node-id="3149:19" aria-hidden="true">
            <ShieldCheck size={24} color="#003C54" strokeWidth={2.2} />
          </span>
          <span className="reg-hero__brand-title" data-node-id="3149:20">
            Безопасный город
          </span>
        </button>

        <div className="reg-hero__content" data-node-id="3149:59">
          <h1 className="reg-hero__heading" data-node-id="3149:22">
            Помощь рядом, когда она нужна
          </h1>
          <p className="reg-hero__subtitle" data-node-id="3149:23">
            SOS близким, оповещения для жителей и карта опасных мест — в одном приложении
          </p>

          <div className="reg-hero__features" data-node-id="3149:58">
            <div className="reg-hero__feature" data-node-id="3149:38">
              <div className="reg-hero__feature-icon" data-node-id="3149:34">
                <Siren size={24} color="#00C9B7" strokeWidth={2} />
              </div>
              <div className="reg-hero__feature-text">
                <span className="reg-hero__feature-title" data-node-id="3149:35">
                  SOS близким
                </span>
                <span className="reg-hero__feature-desc" data-node-id="3149:36">
                  Удерживайте кнопку 3 секунды — близкие получат SMS с вашим местом
                </span>
              </div>
            </div>

            <div className="reg-hero__feature" data-node-id="3149:47">
              <div className="reg-hero__feature-icon" data-node-id="3149:43">
                <Bell size={24} color="#00C9B7" strokeWidth={2} />
              </div>
              <div className="reg-hero__feature-text">
                <span className="reg-hero__feature-title" data-node-id="3149:44">
                  Оповещения о ЧС
                </span>
                <span className="reg-hero__feature-desc" data-node-id="3149:45">
                  Важные сообщения для жителей города
                </span>
              </div>
            </div>

            <div className="reg-hero__feature" data-node-id="3149:57">
              <div className="reg-hero__feature-icon" data-node-id="3149:53">
                <Map size={24} color="#00C9B7" strokeWidth={2} />
              </div>
              <div className="reg-hero__feature-text">
                <span className="reg-hero__feature-title" data-node-id="3149:54">
                  Карта безопасности
                </span>
                <span className="reg-hero__feature-desc" data-node-id="3149:55">
                  Опасные места и пункты помощи рядом
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="reg-hero__footer" data-node-id="3149:60">
          Работает во всех районах города
        </p>
      </aside>

      {/* Правая область с формой регистрации (Десктоп + Мобильная версия iPhone 16) */}
      <main className="reg-form-area page-enter" data-node-id="3149:114">
        <form
          className="reg-card"
          method="post"
          action="/api/auth/register"
          onSubmit={handleSubmit}
          noValidate
          data-node-id="3149:108"
        >
          {/* Мобильная шапка (iPhone 16 / 01 Регистрация) */}
          <div className="reg-mobile-header">
            <div className="reg-mobile-header__icon" data-node-id="3149:2289">
              <ShieldCheck size={32} color="#00C9B7" strokeWidth={2.2} />
            </div>
            <h1 className="reg-mobile-header__title" data-node-id="3149:2290">
              Безопасный город
            </h1>
            <p className="reg-mobile-header__subtitle" data-node-id="3149:2291">
              Экстренная помощь, оповещения и карта опасных мест вашего города
            </p>
            <p className="reg-mobile-header__step" data-node-id="3149:2292">
              {step === 'code'
                ? 'Шаг 2 из 2 · Код из SMS'
                : `Шаг 1 из 2 · ${mode === 'login' ? 'Вход' : 'Регистрация'}`}
            </p>
          </div>

          {/* Заголовок карточки на десктопе */}
          <h2 className="reg-card__title" data-node-id="3149:64">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </h2>
          <p className="reg-card__subtitle" data-node-id="3149:65">
            {step === 'code'
              ? 'Шаг 2 из 2 · Введите код из SMS'
              : mode === 'login'
                ? 'Шаг 1 из 2 · Введите номер, мы пришлём код по SMS'
                : 'Шаг 1 из 2 · Введите данные, мы пришлём код по SMS'}
          </p>

          {isAuthenticated && (
            <div className="reg-session" role="status">
              <span>
                Вы вошли как <strong>{initialUser?.name}</strong>
              </span>
              <div className="reg-session__actions">
                <button type="button" onClick={onGoHome} className="reg-login-row__link">
                  На главную
                </button>
                <button type="button" onClick={onLogout} className="reg-login-row__link">
                  Выйти
                </button>
              </div>
            </div>
          )}

          {step === 'code' && (
            <div className="reg-field-group">
              <label htmlFor="reg-code" className="reg-field-label">
                Код из SMS
              </label>
              <div
                className={`reg-field-control reg-field-control--active ${
                  errors.code ? 'reg-field-control--error' : ''
                }`}
              >
                <input
                  id="reg-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ''));
                    if (errors.code) setErrors({});
                  }}
                  placeholder="Код из SMS"
                  className="reg-input"
                  aria-invalid={Boolean(errors.code)}
                  aria-describedby="reg-code-hint"
                />
              </div>
              <span id="reg-code-hint" className="reg-field-label">
                Отправили на {formatPhone(sentPhone)}
              </span>
              {errors.code && (
                <span className="reg-field-error" role="alert">
                  {errors.code}
                </span>
              )}
              {resendNote && !errors.code && (
                <span className="reg-field-label" role="status">
                  {resendNote}
                </span>
              )}
              <div className="reg-code-actions">
                <button
                  type="button"
                  className="reg-login-row__link"
                  onClick={handleResend}
                  disabled={resendIn > 0 || resending}
                >
                  {resending
                    ? 'Отправляем...'
                    : resendIn > 0
                      ? `Отправить код ещё раз через ${resendIn} с`
                      : 'Отправить код ещё раз'}
                </button>
                <button
                  type="button"
                  className="reg-login-row__link"
                  onClick={() => {
                    setStep('form');
                    setErrors({});
                  }}
                >
                  Изменить номер
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
            <>
              {/* Поле: Имя */}
              {mode === 'register' && (
                <div className="reg-field-group" data-node-id="3149:69">
                  <label htmlFor="reg-name" className="reg-field-label" data-node-id="3149:68">
                    Имя
                  </label>
                  <div
                    className={`reg-field-control ${
                      activeField === 'name' ? 'reg-field-control--active' : ''
                    } ${errors.name ? 'reg-field-control--error' : ''}`}
                    data-node-id="3149:67"
                  >
                    <input
                      id="reg-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      enterKeyHint="next"
                      required
                      value={name}
                      onFocus={() => setActiveField('name')}
                      onBlur={(e) => handleBlur('name', e.target.value)}
                      onChange={handleNameChange}
                      placeholder="Введите ваше Имя и Фамилию"
                      className="reg-input"
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'reg-name-error' : undefined}
                    />
                  </div>
                  {errors.name && (
                    <span id="reg-name-error" className="reg-field-error" role="alert">
                      {errors.name}
                    </span>
                  )}
                </div>
              )}

              {/* Поле: Номер телефона */}
              <div className="reg-field-group" data-node-id="3149:76">
                <label htmlFor="reg-phone" className="reg-field-label" data-node-id="3149:75">
                  Номер телефона
                </label>
                <div
                  className={`reg-field-control ${
                    activeField === 'phone' ? 'reg-field-control--active' : ''
                  } ${errors.phone ? 'reg-field-control--error' : ''}`}
                  data-node-id="3149:74"
                >
                  <Phone
                    size={20}
                    color="#6B7A89"
                    strokeWidth={1.8}
                    className="reg-field-icon"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    enterKeyHint="next"
                    required
                    value={phone}
                    onFocus={() => setActiveField('phone')}
                    onBlur={(e) => handleBlur('phone', e.target.value)}
                    onChange={handlePhoneChange}
                    placeholder="+7 (900) 000-00-00"
                    className="reg-input"
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? 'reg-phone-error' : undefined}
                  />
                </div>
                {errors.phone && (
                  <span id="reg-phone-error" className="reg-field-error" role="alert">
                    {errors.phone}
                  </span>
                )}
              </div>

              {/* Поле: Город */}
              {mode === 'register' && (
                <div className="reg-field-group" data-node-id="3149:87">
                  <label htmlFor="reg-city" className="reg-field-label" data-node-id="3149:86">
                    Город
                  </label>
                  <div
                    className={`reg-field-control reg-field-control--select ${
                      activeField === 'city' ? 'reg-field-control--active' : ''
                    }`}
                    data-node-id="3149:85"
                  >
                    <MapPin
                      size={20}
                      color="#6B7A89"
                      strokeWidth={1.8}
                      className="reg-field-icon"
                      aria-hidden="true"
                    />
                    <select
                      id="reg-city"
                      name="city"
                      autoComplete="address-level2"
                      value={city}
                      onFocus={() => setActiveField('city')}
                      onChange={(e) => setCity(e.target.value)}
                      className="reg-select"
                    >
                      {CITIES.map((cityName) => (
                        <option key={cityName} value={cityName}>
                          {cityName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={20}
                      color="#6B7A89"
                      strokeWidth={1.8}
                      className="reg-select-chevron"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )}

              {/* Доступ к геолокации */}
              {mode === 'register' && (
                <div className="reg-geo-box" data-node-id="3149:101">
                  <LocateFixed
                    size={22}
                    color="#007DA5"
                    strokeWidth={2}
                    className="reg-geo-box__icon"
                    aria-hidden="true"
                  />
                  <div className="reg-geo-box__text" data-node-id="3149:98">
                    <label
                      htmlFor="reg-geo-toggle"
                      className="reg-geo-box__title"
                      data-node-id="3149:96"
                    >
                      Доступ к геолокации
                    </label>
                    <span id="reg-geo-desc" className="reg-geo-box__desc" data-node-id="3149:97">
                      <span className="reg-geo-box__desc-desktop">
                        Нужен, чтобы передавать местоположение при SOS
                      </span>
                      <span className="reg-geo-box__desc-mobile">
                        Нужен, чтобы передавать ваше местоположение при SOS
                      </span>
                    </span>
                  </div>
                  <div className="reg-toggle-wrapper" data-node-id="3149:99">
                    <input
                      id="reg-geo-toggle"
                      name="geolocationEnabled"
                      type="checkbox"
                      checked={geolocationEnabled}
                      onChange={(e) => setGeolocationEnabled(e.target.checked)}
                      aria-describedby="reg-geo-desc"
                      className="visually-hidden reg-toggle-input"
                    />
                    <label
                      htmlFor="reg-geo-toggle"
                      className={`reg-toggle ${geolocationEnabled ? 'reg-toggle--on' : ''}`}
                    >
                      <span className="reg-toggle__thumb" />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {errors.form && (
            <span className="reg-field-error" role="alert">
              {errors.form}
              {errors.formAction === 'login' && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="reg-login-row__link"
                    disabled={isSubmitting}
                    onClick={() => sendCode('login')}
                  >
                    Войти с этим номером
                  </button>
                </>
              )}
            </span>
          )}

          {/* Кнопка отправки */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="reg-submit-btn"
            data-node-id="3149:103"
          >
            <span className="reg-submit-btn__desktop">
              {step === 'code'
                ? isSubmitting
                  ? 'Проверка...'
                  : 'Войти'
                : isSubmitting
                  ? 'Отправка кода...'
                  : 'Получить код'}
            </span>
            <span className="reg-submit-btn__mobile">
              {step === 'code'
                ? isSubmitting
                  ? 'Проверка...'
                  : 'Подтвердить и войти'
                : isSubmitting
                  ? 'Отправка кода...'
                  : 'Получить код по SMS'}
            </span>
          </button>

          {/* Юридический текст */}
          <p className="reg-legal" data-node-id="3149:104">
            Нажимая кнопку, вы соглашаетесь с условиями использования и обработкой персональных
            данных
          </p>

          {/* Переключатель регистрация / вход. В режиме моков «Войти» просто пускает в приложение */}
          <div className="reg-login-row" data-node-id="3149:107">
            <span className="reg-login-row__prompt" data-node-id="3149:105">
              {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (USE_MOCK) {
                  onGoToLogin?.();
                  return;
                }
                setMode((prev) => (prev === 'login' ? 'register' : 'login'));
                setStep('form');
                setErrors({});
              }}
              className="reg-login-row__link"
              data-node-id="3149:106"
            >
              {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </div>

          {!USE_MOCK && canBrowse && (
            <div className="reg-login-row">
              <button type="button" onClick={onGoToLogin} className="reg-login-row__link">
                Смотреть карту и памятки без входа
              </button>
            </div>
          )}
        </form>

        {/* Плашка экстренного вызова 112 без регистрации */}
        <a href="tel:112" className="reg-hint-112" data-node-id="3149:113">
          <Phone size={18} color="#ED0536" strokeWidth={2} aria-hidden="true" />
          <span className="reg-hint-112__text" data-node-id="3149:112">
            Нужна помощь прямо сейчас? Звоните 112 — без регистрации
          </span>
        </a>
      </main>
    </div>
  );
}
