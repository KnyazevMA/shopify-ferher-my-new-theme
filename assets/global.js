function getCtxFromTranslations() {
    try {
        const el = document.getElementById('Translations');
        return el ? JSON.parse(el.textContent) : {};
    } catch { return {}; }
}
const ctx = getCtxFromTranslations();
function t(key, fallback = '') {
    try {
        if (ctx && Object.prototype.hasOwnProperty.call(ctx, key)) return ctx[key];
        return fallback;
    } catch (_) {
        return fallback;
    }
}

function createSectionSwiper(rootEl, {
    containerSelector,
    nextSelector,
    prevSelector,
    paginationSelector,
    options = {}
} = {}) {
    if (!window.Swiper) {
        console.warn('Swiper is not loaded');
        return null;
    }

    const container = rootEl.querySelector(containerSelector);
    if (!container) {
        console.warn('Swiper container not found:', containerSelector);
        return null;
    }

    const nextEl = nextSelector ? rootEl.querySelector(nextSelector) : null;
    const prevEl = prevSelector ? rootEl.querySelector(prevSelector) : null;
    const paginationEl = paginationSelector ? rootEl.querySelector(paginationSelector) : null;

    const baseConfig = {
        slidesPerView: 4,
        spaceBetween: 24,
        loop: false,
        breakpoints: {
            0: { slidesPerView: 1.2, spaceBetween: 10 },
            450: { slidesPerView: 1.3, spaceBetween: 10 },
            568: { slidesPerView: 2, spaceBetween: 15 },
            700: { slidesPerView: 2.2, spaceBetween: 15 },
            768: { slidesPerView: 2.5, spaceBetween: 20 },
            870: { slidesPerView: 3, spaceBetween: 20 },
            1000: { slidesPerView: 4, spaceBetween: 24 },
        },
    };

    if (nextEl && prevEl) {
        baseConfig.navigation = {
            nextEl,
            prevEl,
        };
    }

    if (paginationEl) {
        baseConfig.pagination = {
            el: paginationEl,
            clickable: true,
        };
    }

    const {
        breakpoints: userBreakpoints,
        pagination: _userPagination,
        navigation: _userNavigation,
        ...restOptions
    } = options || {};

    const finalConfig = {
        ...baseConfig,
        ...restOptions,
        breakpoints: {
            ...baseConfig.breakpoints,
            ...(userBreakpoints || {}),
        },
    };

    return new Swiper(container, finalConfig);
}

class FeaturedProducts {
    constructor(section) {
        this.section = section;
        this.select = section.querySelector('#sort-select');
        this.grid = section.querySelector('.featured-products__grid');
        this.items = Array.from(this.grid.querySelectorAll('.product-card'));

        this.items.forEach((el, i) => {
            if (!el.dataset.index) el.dataset.index = String(i);
        });

        this.swiper = createSectionSwiper(this.section, {
            containerSelector: '.featured-products__grid',
            nextSelector: '.swiper-button-next',
            prevSelector: '.swiper-button-prev',
        });

        if (this.select) {
            const urlSort = new URLSearchParams(window.location.search).get('sort_by');
            const savedSort = urlSort || window.localStorage.getItem('fp_sort');
            if (savedSort && this.hasOption(savedSort)) {
                this.select.value = savedSort;
                this.sortBy(savedSort);
            }

            this.select.addEventListener('change', (e) => {
                const value = e.target.value;
                this.sortBy(value);
                const url = new URL(window.location.href);
                url.searchParams.set('sort_by', value);
                window.history.replaceState({}, '', url);
                window.localStorage.setItem('fp_sort', value);
            });
        }
    }

    hasOption(val) {
        return Array.from(this.select.options).some(o => o.value === val);
    }

    sortBy(value) {
        let sorted = [...this.items];

        if (value === 'price-ascending') {
            sorted.sort((a, b) => this.getPrice(a) - this.getPrice(b));
        } else if (value === 'price-descending') {
            sorted.sort((a, b) => this.getPrice(b) - this.getPrice(a));
        } else if (value === 'title-ascending') {
            sorted.sort((a, b) => this.getTitle(a).localeCompare(this.getTitle(b), undefined, { sensitivity: 'base' }));
        } else {
            sorted.sort((a, b) => this.getIndex(a) - this.getIndex(b));
        }

        const frag = document.createDocumentFragment();
        sorted.forEach(el => frag.appendChild(el));
        this.grid.appendChild(frag);
    }

    getPrice(el) {
        const dp = el.dataset.price;
        if (dp && !Number.isNaN(Number(dp))) return Number(dp);
        const txt = (el.querySelector('.product-card__price')?.textContent || '').replace(/[^\d.,-]/g, '');
        const num = Number(txt.replace(/\./g, '').replace(',', '.'));
        return Number.isNaN(num) ? Number.MAX_SAFE_INTEGER : Math.round(num * 100);
    }

    getTitle(el) {
        return (el.dataset.title || el.querySelector('.product-card__name')?.textContent || '').trim();
    }

    getIndex(el) {
        const di = el.dataset.index;
        return di ? Number(di) : 0;
    }
}

class AddToCart {
    constructor(context = document) {
        this.context = context;
        this.init();
    }

    init() {
        this.context.addEventListener('click', (e) => {
            const btn = e.target.closest('.product-card__btn');
            if (!btn) return;
            e.preventDefault();
            this.handleAdd(btn);
        });
    }

    async handleAdd(btn) {
        const id = btn.dataset.productId;
        if (!id) return;

        const originalText = btn.textContent;
        btn.disabled = true;

        try {
            const res = await fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: Number(id), quantity: 1 })
            });

            if (!res.ok) throw new Error(`Add to cart failed (${res.status})`);
            const data = await res.json();
            this.flash(btn, t('added_short', 'Додано!'), 1200, originalText);

            document.dispatchEvent(new CustomEvent('cart:updated', { detail: data }));
        } catch (err) {
            console.error('Error adding to cart:', err);
            this.flash(btn, t('error_short', 'Помилка'), 1200, originalText);
        } finally {
            btn.disabled = false;
        }
    }

    flash(btn, temp, ms, fallback) {
        btn.textContent = temp;
        setTimeout(() => (btn.textContent = fallback), ms);
    }
}

class AjaxCart {
    constructor(context = document) {
        this.context = context;
        this.init();
    }

    init() {
        this.context.addEventListener('submit', this.onSubmit.bind(this), true);
    }

    async onSubmit(event) {
        const form = event.target;
        if (!form || form.tagName !== 'FORM') return;

        // Honeypot check (anti-spam)
        const hp = form.querySelector('input[name="hp"], input[name="honeypot"]');
        if (hp && hp.value.trim() !== '') {
            event.preventDefault();
            this.flashSubmit(form, t('spam_detected', 'Підозра на спам'), 'error');
            console.warn('Honeypot triggered, form blocked');
            return;
        }

        const action = (form.getAttribute('action') || '').toLowerCase();
        const hasAddAction = action.indexOf('/cart/add') !== -1;
        const hasIdField = !!form.querySelector('input[name="id"]');
        if (!hasAddAction && !hasIdField) return;

        event.preventDefault();

        try {
            form.setAttribute('aria-busy', 'true');
            const submitButtons = Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]'));
            submitButtons.forEach(b => b.disabled = true);

            const fd = new FormData(form);
            const payload = {};
            const properties = {};
            for (const [key, value] of fd.entries()) {
                if (key.startsWith('properties[')) {
                    const m = key.match(/^properties\[(.*)\]$/);
                    const propName = m ? m[1] : key;
                    properties[propName] = value;
                } else {
                    payload[key] = value;
                }
            }
            if (Object.keys(properties).length) payload.properties = properties;

            const body = {
                id: payload.id ? Number(payload.id) : undefined,
                quantity: payload.quantity ? Number(payload.quantity) : (payload.quantity === undefined ? 1 : Number(payload.quantity)),
                properties: payload.properties || {}
            };

            if (!body.id) {
                this.flashSubmit(form, t('missing_product_id', 'Відсутній ідентифікатор товару'), 'error');
                return;
            }

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: 'form_submit',
                formType: 'product',
                productId: (ctx && ctx.productId) || null,
                locale: (ctx && ctx.locale) || null,
                timestamp: Date.now()
            });

            const res = await fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            let data;
            try { data = await res.json(); } catch (e) { data = null; }

            if (!res.ok) {
                const msg = (data && (data.description || data.message || data.error)) ? (data.description || data.message || data.error) : `Add to cart failed (${res.status})`;
                throw new Error(msg);
            }

            const successText = t('added_to_cart', 'Додано до кошика');
            this.flashSubmit(form, successText, 'success');

            const ctxLocal = ctx || {};
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: 'form_success',
                formType: 'product',
                productId: ctxLocal.productId ?? null,
                locale: ctxLocal.locale ?? null
            });

            document.dispatchEvent(new CustomEvent('cart:updated', { detail: data }));

        } catch (err) {
            const message = err && err.message ? err.message : t('error_adding_to_cart', 'Помилка додавання до кошика');
            this.flashSubmit(form, message, 'error');

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: 'form_error',
                formType: 'product',
                message
            });

            console.error('AjaxCart error:', err);
        } finally {
            try { form.removeAttribute('aria-busy'); } catch (e) { }
            const submitButtons = Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]'));
            submitButtons.forEach(b => b.disabled = false);
        }
    }

    showMessage(form, text, type = 'success') { }

    flashSubmit(form, text, type = 'success') {
        const btn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (!btn) return;

        const isInput = btn.tagName === 'INPUT';
        const original = isInput ? (btn.value ?? '') : (btn.textContent ?? '');
        const duration = 3000;

        btn.disabled = true;
        if (isInput) btn.value = text; else btn.textContent = text;
        btn.classList.toggle('is-success', type === 'success');
        btn.classList.toggle('is-error', type === 'error');

        setTimeout(() => {
            if (isInput) btn.value = original; else btn.textContent = original;
            btn.disabled = false;
            btn.classList.remove('is-success');
            btn.classList.remove('is-error');
        }, duration);
    }
}

class BurgerToggle {
    constructor(context = document) {
        this.context = context;
        this.init();
    }

    init() {
        this.context.addEventListener('click', (e) => {
            const btn = e.target.closest('.header__burger');
            if (!btn) return;
            e.preventDefault();
            this.toggle(btn);
        });
    }

    toggle(btn) {
        const active = btn.classList.toggle('header__burger--active');
        btn.setAttribute('aria-expanded', active ? 'true' : 'false');
        document.dispatchEvent(new CustomEvent('burger:toggle', { detail: { active } }));
    }
}

class ProductPage {
    constructor(section) {
        this.section = section;
        this.thumbButtons = Array.from(this.section.querySelectorAll('.product__btn-img'));
        this.availabilityEl = this.section.querySelector('#variant-availability');
        this.addToCartBtn = this.section.querySelector('.product__btn');
        this.mainImageEl = this.section.querySelector('.product__main-img') || this.section.querySelector('.product__wrapper-big-img img');

        this.productId = this.section.dataset.productId;
        this.variantsData = {};
        try {
            const dataEl = this.section.querySelector(`#ProductVariants-${this.productId}`) || document.querySelector(`#ProductVariants-${this.productId}`);
            if (dataEl) this.variantsData = JSON.parse(dataEl.textContent || '{}');
        } catch (e) {
            this.variantsData = {};
            console.error('Failed to parse product variants JSON', e);
        }

        this.bindEvents();
        this.renderDefaultState();
    }

    bindEvents() {
        this.thumbButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const large = btn.dataset.large;
                if (large && this.mainImageEl) {
                    this.mainImageEl.src = large.startsWith('//') ? `https:${large}` : large;
                    this.mainImageEl.srcset = '';
                }
                const group = btn.closest('.product__thumb-group');
                if (group) {
                    group.querySelectorAll('.product__btn-img').forEach(b => b.classList.remove('product__btn-img--active'));
                }
                btn.classList.add('product__btn-img--active');
            });
        });

        this.section.querySelectorAll('input[name="color"]').forEach(input => {
            input.addEventListener('change', (e) => {
                this.updateMainImageFromInput(e.target);
                this.toggleThumbnailGroups(e.target.value);
                this.updateVariantState();
            });
        });

        this.section.querySelectorAll('input[name="size"]').forEach(input => {
            input.addEventListener('change', () => this.updateVariantState());
        });

        this.section.addEventListener('change', (e) => {
            const t = e.target;
            if (!t) return;
            if (t.matches && t.matches('input[name="color"]')) {
                this.updateMainImageFromInput(t);
                this.toggleThumbnailGroups(t.value);
                this.updateVariantState();
            } else if (t.matches && t.matches('input[name="size"]')) {
                this.updateVariantState();
            }
        });

        const form = this.section.querySelector('form#ProductForm') || this.section.querySelector('form');
        if (form) {
            form.addEventListener('submit', (e) => {
                try {
                    form.setAttribute('aria-busy', 'true');
                    const submitButtons = Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]'));
                    submitButtons.forEach(b => b.disabled = true);

                    let cleaned = false;
                    const cleanup = () => {
                        if (cleaned) return;
                        cleaned = true;
                        try { form.removeAttribute('aria-busy'); } catch (err) { }
                        submitButtons.forEach(b => b.disabled = false);
                        document.removeEventListener('cart:updated', cleanup);
                        window.removeEventListener('pageshow', cleanup);
                        if (timer) clearTimeout(timer);
                    };

                    document.addEventListener('cart:updated', cleanup);
                    window.addEventListener('pageshow', cleanup);
                    var timer = setTimeout(cleanup, 10000);
                } catch (err) {
                    console.error('ProductForm submit handler error', err);
                }
            });
        }
    }

    renderDefaultState() {
        const defaultColor = this.section.querySelector('input[name="color"]:checked');
        if (defaultColor) {
            this.toggleThumbnailGroups(defaultColor.value);
            this.updateMainImageFromInput(defaultColor);
        }
        this.updateVariantState();
    }

    toggleThumbnailGroups(color) {
        const groups = this.section.querySelectorAll('.product__thumb-group');
        groups.forEach(g => g.style.display = (g.dataset.color === (color || '').toLowerCase()) ? '' : 'none');
    }

    updateMainImageFromInput(input) {
        const imageUrl = input && input.dataset ? input.dataset.image : null;
        if (!imageUrl || !this.mainImageEl) return;
        this.mainImageEl.src = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
        this.mainImageEl.srcset = '';
    }

    findMatchingVariant(color, size) {
        const norm = (v) => (v ?? '').toString().trim().toLowerCase();
        const c = norm(color);
        const s = norm(size);

        const list = Object.values(this.variantsData || {});
        return list.find(v => {
            const v1 = norm(v.option1);
            const v2 = norm(v.option2);
            const matchColor = color != null && color !== '' ? (v1 === c || v2 === c) : true;
            const matchSize = size != null && size !== '' ? (v1 === s || v2 === s) : true;
            if (color && size) {
                return (v1 === c && v2 === s) || (v1 === s && v2 === c);
            }
            return matchColor && matchSize;
        }) || null;
    }

    updateVariantState() {
        const color = this.section.querySelector('input[name="color"]:checked')?.value;
        const size = this.section.querySelector('input[name="size"]:checked')?.value;
        const priceEl = this.section.querySelector('#ProductPrice');
        const compareEl = this.section.querySelector('#ProductCompare');

        const found = this.findMatchingVariant(color, size);

        if (!found) {
            this.setSoldOut();
            return;
        }

        if (found.price_money) priceEl.textContent = found.price_money;
        if (found.compare_money && found.compare_money !== found.price_money) {
            compareEl.textContent = found.compare_money;
            compareEl.hidden = false;
        } else {
            compareEl.hidden = true;
        }

        const qty = Number(found.inventory_quantity ?? 0);
        const managed = Boolean(found.inventory_management);
        const policy = (found.inventory_policy || 'deny').toLowerCase();
        const isAvail = Boolean(found.available);

        if (!isAvail) {
            this.setSoldOut();
        } else if (!managed || policy === 'continue' || qty <= 0) {
            this.setAvailable();
        } else {
            this.setAvailable(qty);
        }

        const inputId = this.section.querySelector('input[name="id"]');
        if (inputId) {
            inputId.value = found.id;
            if (this.addToCartBtn) this.addToCartBtn.dataset.productId = found.id;
        }
    }

    setAvailable(qty) {
        const labelWithCount = t('in_stock', 'In stock:');
        const labelGeneric = t('in_stock_generic', 'In stock');

        if (this.availabilityEl) {
            const showCount = typeof qty === 'number' && qty > 0;
            this.availabilityEl.textContent = showCount
                ? `${labelWithCount} ${qty}`
                : labelGeneric;
        }
        if (this.addToCartBtn) this.addToCartBtn.disabled = false;
    }

    setSoldOut() {
        const soldText = t('sold_out', 'Sold out');
        if (this.availabilityEl) this.availabilityEl.textContent = soldText;
        if (this.addToCartBtn) this.addToCartBtn.disabled = true;
    }
}

class QuantityValidator {
    constructor(input) {
        this.input = input;
        this.tooltip = null;
        this.init();
    }

    init() {
        this.input.addEventListener('invalid', e => {
            e.preventDefault();
            this.showTooltip(t('quantity_min_error', 'Quantity must be at least 1'));
        });

        this.input.addEventListener('input', () => this.hideTooltip());
    }

    showTooltip(message) {
        if (this.tooltip) this.tooltip.remove();

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip tooltip--error';
        this.tooltip.textContent = message;

        this.input.parentNode.appendChild(this.tooltip);
        requestAnimationFrame(() => this.tooltip.classList.add('visible'));
    }

    hideTooltip() {
        if (!this.tooltip) return;
        this.tooltip.classList.remove('visible');
        setTimeout(() => this.tooltip?.remove(), 200);
    }
}

class QuantityStepper {
    constructor(context = document) {
        this.context = context;
        this.onClick = this.onClick.bind(this);
        this.init();
    }

    init() {
        this.context.addEventListener('click', this.onClick);
    }

    onClick(e) {
        const btn = e.target.closest('[data-qty], .quantity__btn--plus, .quantity__btn--minus, .quantity__plus, .quantity__minus');
        if (!btn) return;

        let dir = 0;
        const attr = btn.getAttribute('data-qty');
        if (attr === 'plus') dir = +1;
        else if (attr === 'minus') dir = -1;
        else if (btn.classList.contains('quantity__btn--plus') || btn.classList.contains('quantity__plus')) dir = +1;
        else if (btn.classList.contains('quantity__btn--minus') || btn.classList.contains('quantity__minus')) dir = -1;
        if (!dir) return;

        const input = this.getInput(btn);
        if (!input) return;

        e.preventDefault();

        const step = Number(input.step || 1) || 1;
        const min = (input.min !== '' && !Number.isNaN(Number(input.min))) ? Number(input.min) : 1;
        const hasMax = input.max !== '' && !Number.isNaN(Number(input.max));
        const max = hasMax ? Number(input.max) : Number.POSITIVE_INFINITY;

        const current = Number(input.value || 0);
        let next = current + dir * step;

        if (Number.isNaN(next)) next = min;
        if (next < min) next = min;
        if (next > max) next = max;

        input.value = String(next);

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    getInput(btn) {
        const containers = [
            btn.closest('.quantity'),
            btn.closest('form'),
            btn.closest('.product'),
            this.context
        ].filter(Boolean);

        for (const root of containers) {
            const input = root.querySelector('input[name="quantity"]');
            if (input) return input;
        }
        return null;
    }
}

class ProductRecommendationsSection {
    constructor(sectionEl) {
        this.sectionEl = sectionEl;
        this.productId = sectionEl.dataset.productId;
        this.sectionId = sectionEl.dataset.sectionId;

        if (!this.productId || !this.sectionId) return;

        this.fetchRecommendations();
    }

    async fetchRecommendations() {
        const url = `/recommendations/products?section_id=${this.sectionId}&product_id=${this.productId}`;

        try {
            const response = await fetch(url);
            if (!response.ok) return;

            const html = await response.text();

            // Парсим HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newSection = doc.querySelector('[data-section-type="product-recommendations"]');

            // Нічого не повернулося – ховаємо секцію
            if (!newSection) {
                this.sectionEl.style.display = 'none';
                return;
            }

            // Замінюємо вміст поточної секції на новий
            this.sectionEl.innerHTML = newSection.innerHTML;

            // Ініціалізуємо Swiper
            this.swiper = createSectionSwiper(this.sectionEl, {
                containerSelector: '.js-product-recommendations-swiper',
                nextSelector: '.swiper-button-next',
                prevSelector: '.swiper-button-prev',
            });

        } catch (error) {
            console.error('Failed to load product recommendations', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.featured-products').forEach(section => {
        new FeaturedProducts(section);
    });
    document.querySelectorAll('.product').forEach(section => {
        new ProductPage(section);
    });

    document.querySelectorAll('input[name="quantity"]').forEach(inp => {
        new QuantityValidator(inp)
    });

    document.querySelectorAll('[data-section-type="product-recommendations"]').forEach(section => {
        new ProductRecommendationsSection(section);
    });

    new AddToCart(document);
    new BurgerToggle(document);
    new AjaxCart(document);
    new QuantityStepper(document);
});