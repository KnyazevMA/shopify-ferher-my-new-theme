class FeaturedProducts {
    constructor(section) {
        this.section = section;
        this.select = section.querySelector('#sort-select');
        this.grid = section.querySelector('.featured-products__grid');
        this.items = Array.from(this.grid.querySelectorAll('.featured-products__item'));

        this.items.forEach((el, i) => {
            if (!el.dataset.index) el.dataset.index = String(i);
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
        const txt = (el.querySelector('.featured-products__price')?.textContent || '').replace(/[^\d.,-]/g, '');
        const num = Number(txt.replace(/\./g, '').replace(',', '.'));
        return Number.isNaN(num) ? Number.MAX_SAFE_INTEGER : Math.round(num * 100);
    }

    getTitle(el) {
        return (el.dataset.title || el.querySelector('.featured-products__name')?.textContent || '').trim();
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
            const btn = e.target.closest('.featured-products__btn');
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
            this.flash(btn, 'Added!', 1200, originalText);

            document.dispatchEvent(new CustomEvent('cart:updated', { detail: data }));
        } catch (err) {
            console.error('Error adding to cart:', err);
            this.flash(btn, 'Error', 1200, originalText);
        } finally {
            btn.disabled = false;
        }
    }

    flash(btn, temp, ms, fallback) {
        btn.textContent = temp;
        setTimeout(() => (btn.textContent = fallback), ms);
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

        const productId = this.section.dataset.productId;
        try {
            this.variantsData = JSON.parse(document.querySelector(`#ProductVariants-${productId}`).textContent);
        } catch (e) {
            this.variantsData = {};
        }

        this.bindEvents();
        this.renderDefaultState();
    }

    bindEvents() {
        // thumbnails
        this.thumbButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const large = btn.dataset.large;
                if (large && this.mainImageEl) {
                    this.mainImageEl.src = large.startsWith('//') ? `https:${large}` : large;
                    this.mainImageEl.srcset = '';
                }
                // toggle active state
                btn.closest('.product__thumb-group')
                    .querySelectorAll('.product__btn-img')
                    .forEach(b => b.classList.remove('product__btn-img--active'));
                btn.classList.add('product__btn-img--active');
            });
        });

        // option radios (color/size)
        this.section.querySelectorAll('input[name="color"]').forEach(input => {
            input.addEventListener('change', () => {
                this.updateMainImageFromInput(input);
                this.updateVariantState();
                this.toggleThumbnailGroups(input.value);
            });
        });

        this.section.querySelectorAll('input[name="size"]').forEach(input => {
            input.addEventListener('change', () => this.updateVariantState());
        });
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
        const imageUrl = input.dataset.image;
        if (!imageUrl || !this.mainImageEl) return;
        this.mainImageEl.src = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
        this.mainImageEl.srcset = '';
    }

    updateVariantState() {
        // determine selected option values
        const color = this.section.querySelector('input[name="color"]:checked')?.value;
        const size = this.section.querySelector('input[name="size"]:checked')?.value;

        // find matching variant in this.variantsData (fallback to first)
        const variants = Object.values(this.variantsData || {});
        const found = variants.find(v => {
            const matchColor = v.option1 ? (v.option1 || '').toLowerCase() === (color || '').toLowerCase() : true;
            const matchSize = v.option2 ? (v.option2 || '').toLowerCase() === (size || '').toLowerCase() : true;
            return matchColor && matchSize;
        });

        if (!found) {
            this.setSoldOut();
            return;
        }

        const qty = Number(found.inventory_quantity || 0);
        const available = Boolean(found.available);
        if (available && qty > 0) this.setAvailable(qty);
        else this.setSoldOut();
        // update hidden input id for form to selected variant
        const inputId = this.section.querySelector('input[name="id"]');
        if (inputId) inputId.value = found.id;
    }

    setAvailable(qty) {
        const translations = (document.querySelector('#Translations') && JSON.parse(document.querySelector('#Translations').textContent)) || {};
        const inStockText = translations.in_stock || 'In stock: ';
        if (this.availabilityEl) this.availabilityEl.textContent = `${inStockText} ${qty}`;
        if (this.addToCartBtn) this.addToCartBtn.disabled = false;
    }

    setSoldOut() {
        const translations = (document.querySelector('#Translations') && JSON.parse(document.querySelector('#Translations').textContent)) || {};
        const soldText = translations.sold_out || 'Sold out';
        if (this.availabilityEl) this.availabilityEl.textContent = soldText;
        if (this.addToCartBtn) this.addToCartBtn.disabled = true;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.featured-products').forEach(section => {
        new FeaturedProducts(section);
    });
    document.querySelectorAll('.product').forEach(section => {
        new ProductPage(section)
    });

    new AddToCart(document);
    new BurgerToggle(document);
});