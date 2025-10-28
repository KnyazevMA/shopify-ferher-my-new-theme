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

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.featured-products').forEach(section => {
        new FeaturedProducts(section);
    });

    new AddToCart(document);
});