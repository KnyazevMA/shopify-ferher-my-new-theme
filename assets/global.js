class ProductDetail {
  constructor(section) {
    this.section = section;
    this.colorInputs = this.section.querySelectorAll('input[name="color"]');
    this.sizeInputs = this.section.querySelectorAll('input[name="size"]');
    this.availabilityEl = this.section.querySelector('#variant-availability');
    this.addToCartBtn = this.section.querySelector('.product-detail__btn');
    this.mainImageEl = this.section.querySelector('.product-detail__wrapper-big-img img');

    const productId = section.dataset.productId;
    this.variantsData = JSON.parse(document.querySelector(`#ProductVariants-${productId}`).textContent);
    const translationsEl = document.querySelector('#Translations');
    this.translations = translationsEl ? JSON.parse(translationsEl.textContent) : {};

    this.init();
  }

  init() {
    this.bindEvents();
    this.renderDefaultState();
    this.bindThumbnailClicks();
  }

  bindEvents() {
    this.colorInputs.forEach(input => {
      input.addEventListener('change', () => {
        const color = input.value.toLowerCase();
        this.toggleThumbnailGroups(color);
        this.updateMainImage(color);
        this.updateVariant();
      });
    });
    this.sizeInputs.forEach(input => {
      input.addEventListener('change', () => this.updateVariant());
    });
  }

  renderDefaultState() {
    const defaultColor = this.section.querySelector('input[name="color"]:checked');
    if (defaultColor) {
      const color = defaultColor.value.toLowerCase();
      this.toggleThumbnailGroups(color);
      this.updateMainImage(color);
    }
    this.updateVariant();
  }

  updateVariant() {
    const color = this.section.querySelector('input[name="color"]:checked')?.value;
    const size = this.section.querySelector('input[name="size"]:checked')?.value;

    const variantEl = Object.values(this.variantsData).find(v =>
      v.option1?.toLowerCase() === color?.toLowerCase() &&
      v.option2?.toLowerCase() === size?.toLowerCase()
    );

    if (!variantEl) return this.setSoldOut();

    const quantity = Number(variantEl.inventory_quantity);
    const available = Boolean(variantEl.available);
    if (available && quantity > 0) {
      this.setAvailable(quantity);
    } else {
      this.setSoldOut();
    }
  }

  setAvailable(quantity) {
    const textTemplate = this.translations.in_stock || 'In stock: ';
    this.availabilityEl.textContent = `${textTemplate} ${quantity}`;
    this.addToCartBtn.disabled = false;
  }

  setSoldOut() {
    const soldOutText = this.translations.sold_out || 'Sold out';
    this.availabilityEl.textContent = soldOutText;
    this.addToCartBtn.disabled = true;
  }

  updateMainImage(colorValue) {
    const variantEl = this.section.querySelector(`input[name = "color"][value = "${colorValue}"]`);
    if (!variantEl) return;

    const imageUrl = variantEl.dataset.image;

    this.mainImageEl.src = imageUrl.startsWith('//') ? `https:${imageUrl} ` : imageUrl;
    this.mainImageEl.srcset = ''; // сброс srcset
  }

  bindThumbnailClicks() {
    const buttons = this.section.querySelectorAll('.product-detail__btn-img');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const large = btn.dataset.large;
        if (large) this.mainImageEl.src = large;

        btn.closest('.product-detail__thumb-group')
          .querySelectorAll('.product-detail__btn-img')
          .forEach(b => b.classList.remove('product-detail__btn-img--active'));

        btn.classList.add('product-detail__btn-img--active');
      });
    });
  }

  toggleThumbnailGroups(color) {
    const thumbGroups = this.section.querySelectorAll('.product-detail__thumb-group');
    thumbGroups.forEach(group => {
      group.style.display = group.dataset.color === color ? '' : 'none';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('.product-detail');
  if (section) new ProductDetail(section);
});