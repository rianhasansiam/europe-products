# SexToy visual refresh

Implemented on 25 October 2026 using the existing Next.js 16 App Router, Tailwind 4 semantic variables, shared UI primitives, and optimized `next/font` mechanism. No framework or dependency changes.

## Theme and typography

- Deep rose primary (`#8B2F55`) and hover (`#702344`), warm off-white page (`#FFF8FB`), white cards, blush secondary surfaces (`#F6E4EC`), plum headings, and warm charcoal body text.
- Centralized colors in `app/globals.css`, with compatibility aliases for existing brand utilities and corresponding dark tokens. Success, warning, error, and informational states remain distinct.
- Muted text is slightly deeper than the supplied starting palette (`#74646E`) so it passes normal-text contrast on blush (4.54:1). Form borders use a stronger dedicated input token; decorative dividers retain light rose-gray.
- Manrope is loaded through `next/font/google` at 400, 500, 600, and 700 with system-ui/sans-serif fallbacks and existing native-script fallbacks. Body text is 16px with comfortable line spacing. Existing heavier heading utilities resolve to the loaded 700 weight. Transaction identifiers retain a system monospace stack.
- Buttons/inputs use 12px radii, product cards 16px, and large section surfaces 24px. Primary actions pair with the appropriate contrasting foreground in each theme.

## Shared components and pages

- Navigation, category menus, language selector, search, top banner, footer, menus, sheets, dialogs, notifications, loading and error states.
- Product cards, filters, catalog/category/brand pages, home sections, product details, descriptions, reviews, and existing banners. Stored banner colors remain as a subtle tint under a 94% secondary-surface overlay.
- Cart, checkout, wishlist, account/profile/order surfaces, sign-in/registration, contact/about, and shared policy components.
- Improved product-title wrapping, price hierarchy, touch targets, focus styles, input labels/error associations, disabled states, and totals/action emphasis.
- Reduced decorative zoom, ping, bounce and background animation. Global reduced-motion CSS and the existing Framer Motion provider respect the visitor's motion preference. Carousel content rotation remains intact; its decorative transition is removed.
- Existing brand, text, links, product data, imagery/aspect ratios, navigation structure, currency calculations, USD-only transactions, and Airwallex payment behavior remain intact. No API, authentication, routing, schema, order-processing, payment, dependency, or `.env` files changed. No removed phone/address/map content was added.

## Validation

| Check | Result |
| --- | --- |
| `npm run lint` | Passed with one pre-existing warning in `features/http/api-envelope.ts:22` (`_` unused). |
| `npm run typecheck` | Passed. |
| `npm run i18n:validate` | Passed for prepared English/Bengali catalogs, 2,876 required messages each. |
| `npm test` | 74 suites passed, 2 skipped; 988 tests passed, 14 skipped. |
| `npm run build` | Passed using process-only configuration pointing at a disposable local PostgreSQL database. |
| `git diff --check` | Passed. |

Browser checks were performed using Chrome at 320px, 390px, 768px, 1280px and 1440px widths across representative screens. Checked home/catalog cards and long names, mobile navigation and Escape focus return, product details, filters, empty wishlist/cart, sign-in, cart pricing, and the guest checkout form. The checked layouts fit without horizontal page overflow. Tablet checkout inputs were measured at 44px high with 16px text. Desktop search was widened after visual review.

A temporary local component preview was used to inspect dark cards/buttons/inputs, disabled/loading controls, validation feedback and distinct status surfaces; it was removed afterward. Core contrast checks include white/rose buttons 7.97:1, body/card 8.99:1, muted/blush 4.54:1, light input borders/card 3.10:1, dark primary buttons 7.48:1, and dark body/card 10.42:1. Motion preference handling was verified in the CSS and installed animation-provider implementation; OS/browser reduced-motion emulation was not performed.

The workspace had no configured application database connection or authentication secret. Visual work used a disposable local database with explicitly labeled placeholder products and process-only preview settings. The local cart fixture, temporary preview route and generated fixture caches/build artifacts were cleaned up afterward. No production data was modified.

Live Airwallex payment completion, authenticated profile/order journeys and real production-catalog imagery were not verified. The local preview reported payment configuration unavailable. Browser extensions injected attributes that produced development hydration warnings; no suppression or application logic changes were made for those extension warnings.

Only the two intended visual assertions in `product-card-responsive.test.ts` and `rtl-layout.test.ts` were updated; functional checks remain intact.

## Files modified

- `__tests__/product-card-responsive.test.ts`
- `__tests__/rtl-layout.test.ts`
- `app/(auth)/_components/AuthAnimations.tsx`
- `app/(auth)/_components/AuthBackground.tsx`
- `app/(auth)/_components/BrandPanel.tsx`
- `app/(auth)/_components/FloatField.tsx`
- `app/(auth)/_components/GoogleSignInButton.tsx`
- `app/(auth)/_components/PasswordVisibilityButton.tsx`
- `app/(auth)/login/components/LoginForm.tsx`
- `app/(auth)/login/components/LoginHeader.tsx`
- `app/(auth)/login/components/SuccessState.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/components/PasswordStrengthMeter.tsx`
- `app/(auth)/register/components/RegisterFooter.tsx`
- `app/(auth)/register/components/RegisterHeader.tsx`
- `app/(auth)/register/components/Stepper.tsx`
- `app/(auth)/register/components/SuccessState.tsx`
- `app/(auth)/register/components/TermsCheckbox.tsx`
- `app/(auth)/register/page.tsx`
- `app/(shop)/about/components/AboutCTA.tsx`
- `app/(shop)/about/components/AboutHero.tsx`
- `app/(shop)/about/components/OurStory.tsx`
- `app/(shop)/about/components/OurValues.tsx`
- `app/(shop)/about/components/TeamSection.tsx`
- `app/(shop)/about/components/Testimonials.tsx`
- `app/(shop)/about/components/WhyChooseUs.tsx`
- `app/(shop)/about/page.tsx`
- `app/(shop)/brands/[slug]/page.tsx`
- `app/(shop)/brands/page.tsx`
- `app/(shop)/cart/components/CartHeader.tsx`
- `app/(shop)/cart/components/CartItemCard.tsx`
- `app/(shop)/cart/components/EmptyCart.tsx`
- `app/(shop)/cart/components/FreeShippingBar.tsx`
- `app/(shop)/cart/components/OrderSummary.tsx`
- `app/(shop)/cart/components/PromoCodeInput.tsx`
- `app/(shop)/cart/components/QuantityStepper.tsx`
- `app/(shop)/cart/components/SavedForLater.tsx`
- `app/(shop)/cart/page.tsx`
- `app/(shop)/categories/[...segments]/page.tsx`
- `app/(shop)/categories/page.tsx`
- `app/(shop)/checkout/components/CheckoutHeader.tsx`
- `app/(shop)/checkout/components/CheckoutItemsCard.tsx`
- `app/(shop)/checkout/components/CustomerForm.tsx`
- `app/(shop)/checkout/components/OrderSummaryCard.tsx`
- `app/(shop)/checkout/components/PaymentMethodPicker.tsx`
- `app/(shop)/checkout/page.tsx`
- `app/(shop)/components/CarouselBanner.tsx`
- `app/(shop)/components/Categories.tsx`
- `app/(shop)/components/CategoriesBanner.tsx`
- `app/(shop)/components/CategoryScroller.tsx`
- `app/(shop)/contact/components/ContactForm.tsx`
- `app/(shop)/contact/components/ContactHero.tsx`
- `app/(shop)/contact/components/ContactInfoCards.tsx`
- `app/(shop)/contact/components/FAQSection.tsx`
- `app/(shop)/contact/page.tsx`
- `app/(shop)/orders/[id]/components/OrderSummaryClient.tsx`
- `app/(shop)/orders/[id]/components/OrderTracker.tsx`
- `app/(shop)/products/[slug]/components/Breadcrumbs.tsx`
- `app/(shop)/products/[slug]/components/DealsCarousel.tsx`
- `app/(shop)/products/[slug]/components/DeferredProductSections.tsx`
- `app/(shop)/products/[slug]/components/ProductActions.tsx`
- `app/(shop)/products/[slug]/components/ProductGallery.tsx`
- `app/(shop)/products/[slug]/components/ProductInfo.tsx`
- `app/(shop)/products/[slug]/components/ProductTabs.tsx`
- `app/(shop)/products/[slug]/components/PromoBanners.tsx`
- `app/(shop)/products/[slug]/components/RecentProducts.tsx`
- `app/(shop)/products/[slug]/components/RelatedProducts.tsx`
- `app/(shop)/products/[slug]/components/ReviewSection.tsx`
- `app/(shop)/products/[slug]/page.tsx`
- `app/(shop)/products/components/FilterSidebar.tsx`
- `app/(shop)/products/components/MobileFilterDrawer.tsx`
- `app/(shop)/products/components/ProductToolbar.tsx`
- `app/(shop)/products/components/ProductsExplorer.tsx`
- `app/(shop)/products/components/ProductsGrid.tsx`
- `app/(shop)/products/page.tsx`
- `app/(shop)/profile/components/CartTab.tsx`
- `app/(shop)/profile/components/OrdersTab.tsx`
- `app/(shop)/profile/components/OverviewTab.tsx`
- `app/(shop)/profile/components/ProfileClient.tsx`
- `app/(shop)/profile/components/ProfileHeader.tsx`
- `app/(shop)/profile/components/ProfileSidebar.tsx`
- `app/(shop)/profile/components/SecurityTab.tsx`
- `app/(shop)/profile/components/SettingsTab.tsx`
- `app/(shop)/profile/components/TransactionsTab.tsx`
- `app/(shop)/profile/components/WishlistTab.tsx`
- `app/(shop)/wishlist/components/BulkActionsBar.tsx`
- `app/(shop)/wishlist/components/EmptyWishlist.tsx`
- `app/(shop)/wishlist/components/WishlistCard.tsx`
- `app/(shop)/wishlist/components/WishlistHero.tsx`
- `app/(shop)/wishlist/components/WishlistToolbar.tsx`
- `app/(shop)/wishlist/page.tsx`
- `app/error.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `app/providers.tsx`
- `components/i18n/LanguageSelector.tsx`
- `components/i18n/PreparedLanguageLinksClient.tsx`
- `components/layout/CategoryNavigation.tsx`
- `components/layout/Footer.tsx`
- `components/layout/Navbar.tsx`
- `components/layout/SearchBar.tsx`
- `components/layout/SiteChrome.tsx`
- `components/layout/TopBannerClient.tsx`
- `components/policy/PolicyContactBlock.tsx`
- `components/policy/PolicyHero.tsx`
- `components/policy/PolicyLayout.tsx`
- `components/policy/PolicyList.tsx`
- `components/policy/PolicySection.tsx`
- `components/policy/RelatedPolicies.tsx`
- `components/product/ProductCard.tsx`
- `components/product/product-description/ProductDescriptionRenderer.tsx`
- `components/product/product-description/blocks/FeatureGridBlockView.tsx`
- `components/product/product-description/blocks/ImageTextBlockView.tsx`
- `components/product/product-description/blocks/RichTextBlockView.tsx`
- `components/product/product-description/blocks/SpecificationTableBlockView.tsx`
- `components/ui/ConfirmDialog.tsx`
- `components/ui/Toaster.tsx`
- `components/ui/button.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/input.tsx`
- `components/ui/loading.tsx`
- `components/ui/sheet.tsx`
- `docs/theme-refresh.md` (this report)
