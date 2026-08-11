/*
 * Composición visual completa en utilidades Tailwind.
 * Las variantes arbitrarias mantienen las clases semánticas del HTML sin
 * depender de selectores escritos en hojas CSS tradicionales.
 */
export const APP_TAILWIND_CLASSES = `
  block min-h-screen w-full min-w-0 bg-brand-cream font-body text-brand-text
  [&_*]:box-border [&_*]:min-w-0
  [&_a]:text-inherit [&_a]:no-underline
  [&_button]:font-display [&_button]:tracking-[.02em]
  [&_button]:disabled:cursor-not-allowed [&_button]:disabled:opacity-60
  [&_h1]:font-display [&_h1]:font-medium [&_h1]:uppercase [&_h1]:leading-[.96] [&_h1]:tracking-normal
  [&_h2]:font-display [&_h2]:font-medium [&_h3]:font-display [&_h3]:font-medium
  [&_b]:font-display [&_strong]:font-display
  [&_p]:leading-[1.65] [&_p]:text-brand-muted
  [&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-[7px] [&_input]:border [&_input]:border-brand-border [&_input]:bg-white [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-brand-text
  [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-[7px] [&_select]:border [&_select]:border-brand-border [&_select]:bg-white [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-brand-text
  [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-[7px] [&_textarea]:border [&_textarea]:border-brand-border [&_textarea]:bg-white [&_textarea]:p-3 [&_textarea]:text-brand-text
  [&_input:focus]:border-brand-green [&_input:focus]:outline-2 [&_input:focus]:outline-brand-green/40
  [&_select:focus]:border-brand-green [&_select:focus]:outline-2 [&_select:focus]:outline-brand-green/40
  [&_textarea:focus]:border-brand-green [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-brand-green/40
  [&_a]:touch-manipulation [&_button]:touch-manipulation
  [&_a:focus-visible]:rounded-sm [&_a:focus-visible]:outline-3 [&_a:focus-visible]:outline-offset-3 [&_a:focus-visible]:outline-brand-gold
  [&_button:focus-visible]:outline-3 [&_button:focus-visible]:outline-offset-3 [&_button:focus-visible]:outline-brand-gold
  [&_input:focus-visible]:outline-3 [&_input:focus-visible]:outline-offset-2 [&_input:focus-visible]:outline-brand-green/60
  [&_select:focus-visible]:outline-3 [&_select:focus-visible]:outline-offset-2 [&_select:focus-visible]:outline-brand-green/60
  [&_textarea:focus-visible]:outline-3 [&_textarea:focus-visible]:outline-offset-2 [&_textarea:focus-visible]:outline-brand-green/60
  [&_.eyebrow]:font-display [&_.eyebrow]:text-xs [&_.eyebrow]:font-semibold [&_.eyebrow]:tracking-[.2em] [&_.eyebrow]:text-brand-gold
  [&_.link]:cursor-pointer [&_.link]:border-0 [&_.link]:bg-transparent [&_.link]:text-inherit
  [&_.full]:w-full
  [&_.btn]:inline-flex [&_.btn]:min-h-11 [&_.btn]:cursor-pointer [&_.btn]:items-center [&_.btn]:justify-center [&_.btn]:rounded-lg [&_.btn]:border [&_.btn]:border-brand-dark [&_.btn]:px-5 [&_.btn]:py-3 [&_.btn]:font-display [&_.btn]:font-semibold [&_.btn]:transition
  [&_.btn:hover]:-translate-y-0.5 [&_.btn:hover]:shadow-[4px_4px_0_var(--color-brand-gold)]
  [&_.btn.primary]:border-brand-green [&_.btn.primary]:bg-brand-green [&_.btn.primary]:text-brand-paper
  [&_.btn.primary:hover]:bg-brand-dark
  [&_.btn.ghost]:bg-transparent
  [&_.btn.danger]:border-red-200 [&_.btn.danger]:bg-red-50 [&_.btn.danger]:text-brand-danger
  [&_.btn.destructive]:border-brand-danger [&_.btn.destructive]:bg-brand-danger [&_.btn.destructive]:text-white
  [&_.panel]:rounded-[14px] [&_.panel]:border [&_.panel]:border-brand-border [&_.panel]:bg-brand-paper [&_.panel]:p-6 [&_.panel]:shadow-[0_14px_42px_rgba(34,53,38,.06)]
  [&_.notice]:border-l-4 [&_.notice]:border-brand-gold [&_.notice]:bg-[#e7f1dc] [&_.notice]:p-3 [&_.notice]:text-brand-green
  [&_.error-notice]:border-brand-danger [&_.error-notice]:bg-red-50 [&_.error-notice]:text-brand-danger
  [&_.error]:bg-red-50 [&_.error]:p-3 [&_.error]:text-brand-danger
  [&_.field-error]:mt-0.5 [&_.field-error]:block [&_.field-error]:font-bold [&_.field-error]:leading-snug [&_.field-error]:text-brand-danger
  [&_.empty]:grid [&_.empty]:min-h-32 [&_.empty]:place-content-center [&_.empty]:gap-2 [&_.empty]:rounded-xl [&_.empty]:border [&_.empty]:border-dashed [&_.empty]:border-brand-border [&_.empty]:p-8 [&_.empty]:text-center [&_.empty]:text-brand-muted
  [&_.tag]:inline-flex [&_.tag]:w-max [&_.tag]:rounded [&_.tag]:bg-[#e7eedf] [&_.tag]:px-2 [&_.tag]:py-1 [&_.tag]:text-[.65rem] [&_.tag]:font-bold [&_.tag]:tracking-[.08em] [&_.tag]:text-brand-green
  [&_.actions]:flex [&_.actions]:flex-wrap [&_.actions]:gap-3

  [&_.site-header]:sticky [&_.site-header]:top-0 [&_.site-header]:z-30 [&_.site-header]:block [&_.site-header]:h-[76px] [&_.site-header]:border-b [&_.site-header]:border-brand-gold/30 [&_.site-header]:bg-brand-dark [&_.site-header]:px-6 [&_.site-header]:text-brand-paper [&_.site-header]:shadow-[0_8px_24px_rgba(15,31,20,.09)]
  [&_.site-header-inner]:relative [&_.site-header-inner]:z-10 [&_.site-header-inner]:mx-auto [&_.site-header-inner]:flex [&_.site-header-inner]:h-full [&_.site-header-inner]:w-full [&_.site-header-inner]:max-w-[1200px] [&_.site-header-inner]:items-center [&_.site-header-inner]:justify-between
  [&_.brand-logo]:block [&_.brand-logo]:h-14 [&_.brand-logo]:w-28 [&_.brand-logo]:shrink-0
  [&_.brand-logo_img]:h-full [&_.brand-logo_img]:w-full [&_.brand-logo_img]:object-contain
  [&_.site-header_nav]:flex [&_.site-header_nav]:h-full [&_.site-header_nav]:items-center [&_.site-header_nav]:gap-7 [&_.site-header_nav]:font-display [&_.site-header_nav]:text-sm [&_.site-header_nav]:font-medium [&_.site-header_nav]:tracking-[.055em]
  [&_.site-header_nav_a]:relative [&_.site-header_nav_a]:inline-flex [&_.site-header_nav_a]:min-h-11 [&_.site-header_nav_a]:items-center [&_.site-header_nav_a]:whitespace-nowrap
  [&_.site-header_nav_a.active]:text-white [&_.site-header_nav_a.active]:after:absolute [&_.site-header_nav_a.active]:after:inset-x-0 [&_.site-header_nav_a.active]:after:bottom-1 [&_.site-header_nav_a.active]:after:h-0.5 [&_.site-header_nav_a.active]:after:bg-brand-gold
  [&_.site-header_.nav-cta]:h-auto [&_.site-header_.nav-cta]:min-h-0 [&_.site-header_.nav-cta]:rounded-full [&_.site-header_.nav-cta]:bg-brand-paper [&_.site-header_.nav-cta]:px-4 [&_.site-header_.nav-cta]:py-2.5 [&_.site-header_.nav-cta]:text-brand-dark
  [&_.site-header.home-header]:absolute [&_.site-header.home-header]:inset-x-0 [&_.site-header.home-header]:top-0 [&_.site-header.home-header]:border-0 [&_.site-header.home-header]:bg-transparent [&_.site-header.home-header]:shadow-none
  [&_.mobile-menu-toggle]:hidden

  [&_.footer]:block [&_.footer]:border-t-4 [&_.footer]:border-brand-gold [&_.footer]:bg-[#173022] [&_.footer]:px-6 [&_.footer]:py-12 [&_.footer]:text-brand-paper
  [&_.footer-container]:mx-auto [&_.footer-container]:grid [&_.footer-container]:w-full [&_.footer-container]:max-w-[1200px] [&_.footer-container]:grid-cols-[1.2fr_1fr_1.2fr] [&_.footer-container]:gap-16
  [&_.footer-brand]:grid [&_.footer-brand]:content-start [&_.footer-brand]:justify-items-start
  [&_.footer-logo]:mb-4 [&_.footer-logo]:h-auto [&_.footer-logo]:w-[105px] [&_.footer-logo]:object-contain
  [&_.footer-title]:mb-3 [&_.footer-title]:text-xs [&_.footer-title]:font-semibold [&_.footer-title]:uppercase [&_.footer-title]:tracking-[.17em] [&_.footer-title]:text-[#a8a05c]
  [&_.footer-brand_p]:m-0 [&_.footer-brand_p]:max-w-[280px] [&_.footer-brand_p]:text-sm [&_.footer-brand_p]:text-[#d4dccf]
  [&_.footer-eyebrow]:mb-3 [&_.footer-eyebrow]:block [&_.footer-eyebrow]:text-xs [&_.footer-eyebrow]:font-semibold [&_.footer-eyebrow]:uppercase [&_.footer-eyebrow]:tracking-[.17em] [&_.footer-eyebrow]:text-[#a8a05c]
  [&_.footer-links]:grid [&_.footer-links]:justify-items-start [&_.footer-links]:gap-2
  [&_.footer-link]:inline-flex [&_.footer-link]:min-h-10 [&_.footer-link]:items-center [&_.footer-link]:text-[#dce3d8]
  [&_.footer-contact]:grid [&_.footer-contact]:content-start [&_.footer-contact]:justify-items-start [&_.footer-contact]:gap-3
  [&_.footer-contact_p]:m-0 [&_.footer-contact_p]:text-sm [&_.footer-contact_p]:text-[#d4dccf]
  [&_.footer-map-link]:inline-flex [&_.footer-map-link]:items-center [&_.footer-map-link]:gap-2 [&_.footer-map-link]:rounded-lg [&_.footer-map-link]:border [&_.footer-map-link]:border-brand-gold/50 [&_.footer-map-link]:px-3 [&_.footer-map-link]:py-2 [&_.footer-map-link]:text-sm
  [&_.footer-bottom]:mx-auto [&_.footer-bottom]:mt-9 [&_.footer-bottom]:flex [&_.footer-bottom]:w-full [&_.footer-bottom]:max-w-[1200px] [&_.footer-bottom]:justify-between [&_.footer-bottom]:gap-7 [&_.footer-bottom]:border-t [&_.footer-bottom]:border-white/10 [&_.footer-bottom]:pt-5
  [&_.footer-bottom_span]:text-[.68rem] [&_.footer-bottom_span]:text-[#9eaea2]

  [&_app-confirm-dialog]:fixed [&_app-confirm-dialog]:inset-0 [&_app-confirm-dialog]:z-[1000] [&_app-confirm-dialog]:block
  [&_.confirm-dialog-backdrop]:fixed [&_.confirm-dialog-backdrop]:inset-0 [&_.confirm-dialog-backdrop]:grid [&_.confirm-dialog-backdrop]:place-items-center [&_.confirm-dialog-backdrop]:bg-[rgba(6,23,18,.78)] [&_.confirm-dialog-backdrop]:p-4 [&_.confirm-dialog-backdrop]:backdrop-blur-[6px]
  [&_.confirm-dialog]:w-full [&_.confirm-dialog]:max-w-[480px] [&_.confirm-dialog]:overflow-visible [&_.confirm-dialog]:rounded-[20px] [&_.confirm-dialog]:border [&_.confirm-dialog]:border-brand-dark/15 [&_.confirm-dialog]:bg-brand-paper [&_.confirm-dialog]:p-7 [&_.confirm-dialog]:text-left [&_.confirm-dialog]:shadow-[0_26px_70px_rgba(0,0,0,.32)]
  [&_.confirm-dialog-icon]:mb-4 [&_.confirm-dialog-icon]:grid [&_.confirm-dialog-icon]:size-[58px] [&_.confirm-dialog-icon]:place-items-center [&_.confirm-dialog-icon]:rounded-full [&_.confirm-dialog-icon]:bg-[#f3d8d2] [&_.confirm-dialog-icon]:font-display [&_.confirm-dialog-icon]:text-3xl [&_.confirm-dialog-icon]:font-bold [&_.confirm-dialog-icon]:text-[#9f3f36] [&_.confirm-dialog-icon]:shadow-[6px_6px_0_rgba(159,63,54,.18)]
  [&_.confirm-dialog_h2]:mb-[9px] [&_.confirm-dialog_h2]:text-[2.35rem] [&_.confirm-dialog_h2]:leading-[1.02]
  [&_.confirm-dialog-message]:m-0 [&_.confirm-dialog-message]:text-[.98rem] [&_.confirm-dialog-message]:text-brand-text
  [&_.confirm-dialog-secondary]:mt-[9px] [&_.confirm-dialog-secondary]:mb-0 [&_.confirm-dialog-secondary]:text-sm
  [&_.confirm-dialog-error]:mt-4 [&_.confirm-dialog-error]:mb-0 [&_.confirm-dialog-error]:border-l-4 [&_.confirm-dialog-error]:border-brand-danger [&_.confirm-dialog-error]:bg-red-50 [&_.confirm-dialog-error]:p-3 [&_.confirm-dialog-error]:text-sm [&_.confirm-dialog-error]:text-brand-danger
  [&_.confirm-dialog-actions]:mt-6 [&_.confirm-dialog-actions]:grid [&_.confirm-dialog-actions]:grid-cols-2 [&_.confirm-dialog-actions]:gap-2.5
  [&_.confirm-dialog-button]:min-h-12 [&_.confirm-dialog-button]:cursor-pointer [&_.confirm-dialog-button]:rounded-[9px] [&_.confirm-dialog-button]:border [&_.confirm-dialog-button]:px-4 [&_.confirm-dialog-button]:py-3 [&_.confirm-dialog-button]:font-semibold [&_.confirm-dialog-button]:transition
  [&_.confirm-dialog-button--secondary]:border-brand-dark [&_.confirm-dialog-button--secondary]:bg-transparent [&_.confirm-dialog-button--secondary]:text-brand-dark
  [&_.confirm-dialog-button--danger]:border-[#963b33] [&_.confirm-dialog-button--danger]:bg-[#963b33] [&_.confirm-dialog-button--danger]:text-white
  [&_.confirm-dialog-button:not(:disabled):hover]:-translate-y-px [&_.confirm-dialog-button:not(:disabled):hover]:shadow-[4px_4px_0_rgba(150,59,51,.16)]

`;

export const APP_TAILWIND_PUBLIC_CLASSES = `
  [&_.hero-poster]:relative [&_.hero-poster]:isolate [&_.hero-poster]:m-0 [&_.hero-poster]:min-h-screen [&_.hero-poster]:w-full [&_.hero-poster]:overflow-hidden [&_.hero-poster]:bg-brand-dark
  [&_.hero-poster-bg]:absolute [&_.hero-poster-bg]:inset-0 [&_.hero-poster-bg]:z-0
  [&_.hero-poster-bg_img]:h-full [&_.hero-poster-bg_img]:w-full [&_.hero-poster-bg_img]:object-cover [&_.hero-poster-bg_img]:object-center
  [&_.hero-poster-overlay]:absolute [&_.hero-poster-overlay]:inset-0 [&_.hero-poster-overlay]:z-[1] [&_.hero-poster-overlay]:bg-[linear-gradient(90deg,rgba(13,38,24,.88)_0%,rgba(13,38,24,.55)_48%,rgba(13,38,24,.08)_100%)]
  [&_.hero-content]:relative [&_.hero-content]:z-[2] [&_.hero-content]:flex [&_.hero-content]:min-h-screen [&_.hero-content]:w-[min(58%,680px)] [&_.hero-content]:flex-col [&_.hero-content]:justify-center [&_.hero-content]:px-0 [&_.hero-content]:pt-[120px] [&_.hero-content]:pb-[70px] [&_.hero-content]:pl-16
  [&_.hero-eyebrow]:mb-6 [&_.hero-eyebrow]:inline-flex [&_.hero-eyebrow]:items-center [&_.hero-eyebrow]:gap-2.5 [&_.hero-eyebrow]:text-brand-gold
  [&_.hero-title]:m-0 [&_.hero-title]:mb-6 [&_.hero-title]:text-[clamp(4.7rem,7.8vw,7.4rem)] [&_.hero-title]:font-medium [&_.hero-title]:leading-[.88] [&_.hero-title]:text-brand-cream [&_.hero-title]:drop-shadow-xl
  [&_.hero-title_em]:text-brand-cream [&_.hero-title_em]:not-italic
  [&_.hero-subtitle]:m-0 [&_.hero-subtitle]:max-w-[460px] [&_.hero-subtitle]:text-lg [&_.hero-subtitle]:text-brand-cream/85
  [&_.hero-actions]:mt-8 [&_.hero-actions]:mb-0
  [&_.hero-actions_.btn]:min-w-[154px] [&_.hero-actions_.btn]:border-brand-cream/80 [&_.hero-actions_.primary]:bg-brand-cream [&_.hero-actions_.primary]:text-brand-dark
  [&_.hero-actions_.ghost]:bg-brand-dark/40 [&_.hero-actions_.ghost]:text-brand-cream
  [&_.hero-details]:mt-9 [&_.hero-details]:grid [&_.hero-details]:w-full [&_.hero-details]:max-w-[680px] [&_.hero-details]:grid-cols-[.9fr_1.15fr_1.35fr] [&_.hero-details]:overflow-hidden [&_.hero-details]:rounded-[14px] [&_.hero-details]:border [&_.hero-details]:border-brand-cream/20 [&_.hero-details]:bg-brand-dark/60 [&_.hero-details]:backdrop-blur-md
  [&_.hero-details>div]:grid [&_.hero-details>div]:content-center [&_.hero-details>div]:gap-1 [&_.hero-details>div]:border-r [&_.hero-details>div]:border-brand-cream/20 [&_.hero-details>div]:px-4 [&_.hero-details>div]:py-3
  [&_.hero-details>div:last-child]:border-0 [&_.hero-details_strong]:text-brand-cream [&_.hero-details_span]:text-xs [&_.hero-details_span]:text-brand-cream/70
  [&_.location-section]:mx-auto [&_.location-section]:grid [&_.location-section]:w-[min(calc(100%-48px),1200px)] [&_.location-section]:grid-cols-[.9fr_1.1fr] [&_.location-section]:items-center [&_.location-section]:gap-16 [&_.location-section]:py-20
  [&_.location-copy_h2]:my-4 [&_.location-copy_h2]:text-[clamp(2.7rem,5vw,4.8rem)] [&_.location-copy_h2]:leading-[.96]
  [&_.location-copy>p]:m-0 [&_.location-copy>p]:max-w-[510px]
  [&_.address-card]:my-7 [&_.address-card]:flex [&_.address-card]:items-center [&_.address-card]:gap-3 [&_.address-card]:border-y [&_.address-card]:border-brand-border [&_.address-card]:py-4
  [&_.address-card>div]:grid [&_.address-card_small]:text-[.62rem] [&_.address-card_small]:tracking-[.16em] [&_.address-card_strong]:text-xl
  [&_.location-pin]:grid [&_.location-pin]:size-11 [&_.location-pin]:place-items-center [&_.location-pin]:rounded-full [&_.location-pin]:bg-brand-green [&_.location-pin]:text-brand-paper
  [&_.maps-button]:gap-4
  [&_.map-frame]:relative [&_.map-frame]:h-[400px] [&_.map-frame]:w-full [&_.map-frame]:overflow-hidden [&_.map-frame]:rounded-3xl [&_.map-frame]:border-[7px] [&_.map-frame]:border-brand-paper [&_.map-frame]:shadow-xl
  [&_.map-frame_iframe]:absolute [&_.map-frame_iframe]:inset-0 [&_.map-frame_iframe]:h-full [&_.map-frame_iframe]:w-full [&_.map-frame_iframe]:border-0

  [&_.page-head]:bg-[linear-gradient(180deg,rgba(226,229,215,.67),transparent)] [&_.page-head]:px-[clamp(20px,7vw,110px)] [&_.page-head]:pt-16 [&_.page-head]:pb-8
  [&_.page-head_h1]:my-3 [&_.page-head_h1]:max-w-[900px] [&_.page-head_h1]:text-[clamp(3rem,6vw,5.5rem)]
  [&_.page-head_p]:max-w-[620px]
  [&_.tabs]:flex [&_.tabs]:flex-wrap [&_.tabs]:gap-5 [&_.tabs_a]:border-b-2 [&_.tabs_a]:border-brand-gold [&_.tabs_a]:font-semibold
  [&_.cards-list]:grid [&_.cards-list]:gap-3 [&_.cards-list]:px-[clamp(20px,7vw,110px)] [&_.cards-list]:pb-20
  [&_.booking-card]:grid [&_.booking-card]:grid-cols-[75px_1fr_auto_auto] [&_.booking-card]:items-center [&_.booking-card]:gap-6 [&_.booking-card]:rounded-xl [&_.booking-card]:border [&_.booking-card]:border-brand-border [&_.booking-card]:bg-white [&_.booking-card]:p-5
  [&_.date-block]:grid [&_.date-block]:h-[68px] [&_.date-block]:place-content-center [&_.date-block]:rounded-lg [&_.date-block]:bg-brand-dark [&_.date-block]:text-center [&_.date-block]:text-white
  [&_.date-block_b]:text-[2rem] [&_.date-block_b]:leading-[.8] [&_.date-block_span]:text-[.7rem] [&_.date-block_span]:uppercase

  [&_.turn-grid-layout]:mx-auto [&_.turn-grid-layout]:mb-20 [&_.turn-grid-layout]:grid [&_.turn-grid-layout]:w-[min(calc(100%-48px),1200px)] [&_.turn-grid-layout]:grid-cols-[320px_1fr] [&_.turn-grid-layout]:rounded-[18px] [&_.turn-grid-layout]:border [&_.turn-grid-layout]:border-brand-border [&_.turn-grid-layout]:bg-brand-paper
  [&_.turn-filters]:grid [&_.turn-filters]:content-start [&_.turn-filters]:gap-7 [&_.turn-filters]:rounded-none [&_.turn-filters]:border-0 [&_.turn-filters]:border-r [&_.turn-filters]:border-brand-border [&_.turn-filters]:p-7 [&_.turn-filters]:shadow-none
  [&_.filter-step]:grid [&_.filter-step]:grid-cols-[38px_1fr] [&_.filter-step]:gap-3
  [&_.filter-step>span]:grid [&_.filter-step>span]:size-[34px] [&_.filter-step>span]:place-items-center [&_.filter-step>span]:rounded-full [&_.filter-step>span]:bg-brand-dark [&_.filter-step>span]:text-xs [&_.filter-step>span]:text-brand-paper
  [&_.filter-step_label]:mb-2 [&_.filter-step_label]:block [&_.filter-step_label]:text-xs [&_.filter-step_label]:font-bold [&_.filter-step_label]:text-brand-muted
  [&_.duration-options]:grid [&_.duration-options]:grid-cols-[repeat(3,minmax(0,1fr))] [&_.duration-options]:gap-2
  [&_.duration-options_button]:grid [&_.duration-options_button]:min-h-[82px] [&_.duration-options_button]:min-w-0 [&_.duration-options_button]:place-content-center [&_.duration-options_button]:gap-2 [&_.duration-options_button]:rounded-lg [&_.duration-options_button]:border [&_.duration-options_button]:border-brand-border [&_.duration-options_button]:bg-white [&_.duration-options_button]:px-2 [&_.duration-options_button]:py-3 [&_.duration-options_button]:text-center
  [&_.duration-options_button.selected]:border-brand-green [&_.duration-options_button.selected]:bg-brand-green [&_.duration-options_button.selected]:text-white [&_.duration-options_button.selected]:shadow-[inset_0_-4px_var(--color-brand-gold)]
  [&_.duration-label]:whitespace-nowrap [&_.duration-label]:text-[.88rem] [&_.duration-label]:leading-none
  [&_.duration-price]:block [&_.duration-price]:whitespace-nowrap [&_.duration-price]:font-body [&_.duration-price]:text-[.68rem] [&_.duration-price]:font-bold [&_.duration-price]:leading-none
  [&_.turn-results]:min-w-0 [&_.turn-results]:p-8
  [&_.turn-results-title]:mb-6 [&_.turn-results-title]:flex [&_.turn-results-title]:items-start [&_.turn-results-title]:justify-between
  [&_.turn-results-title_h2]:my-1 [&_.turn-results-title_h2]:text-3xl
  [&_.turn-results-title_p]:m-0 [&_.turn-results-title>strong]:rounded-lg [&_.turn-results-title>strong]:border [&_.turn-results-title>strong]:border-brand-border [&_.turn-results-title>strong]:px-4 [&_.turn-results-title>strong]:py-2 [&_.turn-results-title>strong]:text-xl
  [&_.start-time-grid]:grid [&_.start-time-grid]:grid-cols-[repeat(auto-fit,minmax(132px,1fr))] [&_.start-time-grid]:gap-3
  [&_.start-time-grid_button]:relative [&_.start-time-grid_button]:grid [&_.start-time-grid_button]:min-h-[104px] [&_.start-time-grid_button]:min-w-0 [&_.start-time-grid_button]:place-content-center [&_.start-time-grid_button]:gap-1.5 [&_.start-time-grid_button]:rounded-xl [&_.start-time-grid_button]:border [&_.start-time-grid_button]:border-brand-green/40 [&_.start-time-grid_button]:bg-brand-paper [&_.start-time-grid_button]:p-4 [&_.start-time-grid_button]:text-center
  [&_.start-time-grid_button:hover]:border-brand-green [&_.start-time-grid_button:hover]:bg-brand-green [&_.start-time-grid_button:hover]:text-white
  [&_.start-time-grid_button.selected]:border-brand-green [&_.start-time-grid_button.selected]:bg-brand-green [&_.start-time-grid_button.selected]:text-white
  [&_.start-time-grid_button>b]:text-3xl [&_.start-time-grid_button>b]:leading-none [&_.start-time-grid_button>span]:text-[.65rem] [&_.start-time-grid_button>span]:tracking-[.14em] [&_.start-time-grid_button>small]:font-body [&_.start-time-grid_button>small]:text-xs

  [&_.modal-backdrop]:fixed [&_.modal-backdrop]:inset-0 [&_.modal-backdrop]:z-[100] [&_.modal-backdrop]:grid [&_.modal-backdrop]:place-items-center [&_.modal-backdrop]:bg-brand-dark/85 [&_.modal-backdrop]:p-3 [&_.modal-backdrop]:backdrop-blur-sm
  [&_.booking-modal]:relative [&_.booking-modal]:max-h-[calc(100dvh-24px)] [&_.booking-modal]:w-[min(620px,100%)] [&_.booking-modal]:overflow-y-auto [&_.booking-modal]:rounded-2xl [&_.booking-modal]:bg-brand-paper [&_.booking-modal]:p-8 [&_.booking-modal]:shadow-2xl
  [&_.booking-modal_h2]:my-2 [&_.booking-modal_h2]:text-[2.45rem]
  [&_.modal-close]:absolute [&_.modal-close]:right-4 [&_.modal-close]:top-3 [&_.modal-close]:grid [&_.modal-close]:size-10 [&_.modal-close]:place-items-center [&_.modal-close]:rounded-full [&_.modal-close]:border-0 [&_.modal-close]:bg-[#edf0e9] [&_.modal-close]:text-2xl
  [&_.booking-summary]:my-5 [&_.booking-summary]:grid [&_.booking-summary]:grid-cols-2 [&_.booking-summary]:overflow-hidden [&_.booking-summary]:rounded-xl [&_.booking-summary]:border [&_.booking-summary]:border-brand-border
  [&_.booking-summary>div]:grid [&_.booking-summary>div]:gap-1 [&_.booking-summary>div]:border-b [&_.booking-summary>div]:border-r [&_.booking-summary>div]:border-brand-border [&_.booking-summary>div]:p-3
  [&_.booking-summary_span]:text-[.68rem] [&_.booking-summary_span]:uppercase [&_.booking-summary_span]:tracking-[.1em] [&_.booking-summary_span]:text-brand-muted
  [&_.booking-summary_strong]:text-lg
  [&_.modal-fields]:grid [&_.modal-fields]:gap-3
  [&_.modal-fields_label]:grid [&_.modal-fields_label]:gap-1.5 [&_.modal-fields_label]:text-xs [&_.modal-fields_label]:font-bold [&_.modal-fields_label]:text-brand-muted
  [&_.booking-modal-footer]:mt-4 [&_.booking-modal-footer]:flex [&_.booking-modal-footer]:items-center [&_.booking-modal-footer]:justify-between [&_.booking-modal-footer]:gap-3
  [&_.cancel-modal]:mx-auto [&_.cancel-modal]:mt-3 [&_.cancel-modal]:block [&_.cancel-modal]:underline
  [&_.booking-success]:py-3 [&_.booking-success]:text-center [&_.booking-success_h2]:text-[3rem]
  [&_.success-check]:mx-auto [&_.success-check]:mb-4 [&_.success-check]:grid [&_.success-check]:size-16 [&_.success-check]:place-items-center [&_.success-check]:rounded-full [&_.success-check]:bg-brand-gold [&_.success-check]:text-4xl [&_.success-check]:font-bold [&_.success-check]:text-brand-dark [&_.success-check]:shadow-[8px_8px_0_var(--color-brand-dark)]
  [&_.success-actions]:mt-5 [&_.success-actions]:flex [&_.success-actions]:justify-center [&_.success-actions]:gap-3
  [&_.cancel-summary]:my-5 [&_.cancel-summary]:grid [&_.cancel-summary]:grid-cols-[1.6fr_1fr_1fr] [&_.cancel-summary]:overflow-hidden [&_.cancel-summary]:rounded-xl [&_.cancel-summary]:border [&_.cancel-summary]:border-red-200 [&_.cancel-summary]:bg-red-50
  [&_.cancel-summary>div]:grid [&_.cancel-summary>div]:gap-1 [&_.cancel-summary>div]:border-r [&_.cancel-summary>div]:border-red-200 [&_.cancel-summary>div]:p-3
  [&_.cancel-actions]:grid [&_.cancel-actions]:grid-cols-2 [&_.cancel-actions]:gap-3

`;

export const APP_TAILWIND_FEATURE_CLASSES = `
  [&_.auth-wrap]:grid [&_.auth-wrap]:min-h-screen [&_.auth-wrap]:grid-cols-[1.08fr_minmax(460px,.92fr)] [&_.auth-wrap]:bg-brand-cream
  [&_.auth-side]:relative [&_.auth-side]:flex [&_.auth-side]:min-h-screen [&_.auth-side]:items-end [&_.auth-side]:overflow-hidden [&_.auth-side]:bg-brand-dark
  [&_.auth-side-image]:absolute [&_.auth-side-image]:inset-0 [&_.auth-side-image]:h-full [&_.auth-side-image]:w-full [&_.auth-side-image]:object-cover
  [&_.auth-side-overlay]:absolute [&_.auth-side-overlay]:inset-0 [&_.auth-side-overlay]:bg-[linear-gradient(180deg,rgba(20,40,27,.08)_25%,rgba(20,40,27,.78)_100%)]
  [&_.auth-side-copy]:relative [&_.auth-side-copy]:z-10 [&_.auth-side-copy]:w-full [&_.auth-side-copy]:max-w-[640px] [&_.auth-side-copy]:p-[clamp(38px,6vw,72px)] [&_.auth-side-copy]:text-brand-cream
  [&_.auth-side-copy_h1]:my-3 [&_.auth-side-copy_h1]:text-[clamp(3.4rem,6.2vw,6rem)] [&_.auth-side-copy_h1]:text-brand-cream
  [&_.auth-side-copy_p]:m-0 [&_.auth-side-copy_p]:max-w-[420px] [&_.auth-side-copy_p]:text-brand-cream/85
  [&_.auth-form-side]:grid [&_.auth-form-side]:place-items-center [&_.auth-form-side]:bg-[radial-gradient(circle_at_90%_8%,rgba(154,151,79,.11),transparent_28%)] [&_.auth-form-side]:p-12
  [&_.auth-card]:m-0 [&_.auth-card]:w-full [&_.auth-card]:max-w-[480px] [&_.auth-card]:p-10
  [&_.auth-card_h2]:my-3 [&_.auth-card_h2]:text-[2.8rem]
  [&_.auth-card_label]:my-3 [&_.auth-card_label]:grid [&_.auth-card_label]:gap-1.5 [&_.auth-card_label]:text-xs [&_.auth-card_label]:font-bold [&_.auth-card_label]:text-brand-muted
  [&_.two]:grid [&_.two]:grid-cols-2 [&_.two]:gap-3
  [&_.auth-message]:mb-4 [&_.auth-message]:border-l-4 [&_.auth-message]:border-brand-gold [&_.auth-message]:bg-brand-gold/10 [&_.auth-message]:p-3 [&_.auth-message]:text-sm [&_.auth-message]:text-brand-dark
  [&_.switch]:mt-4 [&_.switch]:text-center [&_.switch]:text-sm [&_.switch_a]:font-bold [&_.switch_a]:underline
  [&_.phone-control]:grid [&_.phone-control]:grid-cols-[auto_1fr] [&_.phone-country]:flex [&_.phone-country]:items-center [&_.phone-country]:gap-2 [&_.phone-country]:rounded-l-lg [&_.phone-country]:border [&_.phone-country]:border-r-0 [&_.phone-country]:border-brand-border [&_.phone-country]:bg-brand-cream [&_.phone-country]:px-3 [&_.phone-country]:text-sm

  [&_.recovery]:grid [&_.recovery]:min-h-[calc(100vh-76px)] [&_.recovery]:grid-cols-[.9fr_1.1fr] [&_.recovery]:bg-brand-cream
  [&_.recovery-copy]:flex [&_.recovery-copy]:flex-col [&_.recovery-copy]:justify-center [&_.recovery-copy]:bg-brand-dark [&_.recovery-copy]:p-[clamp(45px,8vw,110px)] [&_.recovery-copy]:text-white
  [&_.recovery-copy_h1]:text-[clamp(4rem,8vw,7rem)] [&_.recovery-copy_h1]:text-white
  [&_.recovery-copy_p]:text-[#bdcbc4]
  [&_.recovery-form]:grid [&_.recovery-form]:place-items-center [&_.recovery-form]:px-5 [&_.recovery-form]:py-9
  [&_.recovery-card]:w-full [&_.recovery-card]:max-w-[520px] [&_.recovery-card]:rounded-2xl [&_.recovery-card]:border [&_.recovery-card]:border-brand-border [&_.recovery-card]:bg-brand-paper [&_.recovery-card]:p-[clamp(27px,5vw,48px)] [&_.recovery-card]:shadow-[12px_14px_0_var(--color-brand-gold)]
  [&_.recovery-card_h2]:text-[2.7rem] [&_.recovery-card_label]:my-4 [&_.recovery-card_label]:grid [&_.recovery-card_label]:gap-2 [&_.recovery-card_label]:text-xs [&_.recovery-card_label]:font-bold
  [&_.recovery-success]:border-l-4 [&_.recovery-success]:border-brand-gold [&_.recovery-success]:bg-[#e7f1dc] [&_.recovery-success]:p-4 [&_.recovery-success]:text-brand-green
  [&_.recovery-error]:bg-red-50 [&_.recovery-error]:p-3 [&_.recovery-error]:text-brand-danger
  [&_.recovery-back]:mt-5 [&_.recovery-back]:block [&_.recovery-back]:font-bold [&_.recovery-back]:underline

  [&_.verification-page]:grid [&_.verification-page]:min-h-[calc(100vh-76px)] [&_.verification-page]:place-items-center [&_.verification-page]:bg-[radial-gradient(circle_at_85%_10%,#d8e5c9,transparent_30%)] [&_.verification-page]:px-5 [&_.verification-page]:py-10
  [&_.verification-card]:w-full [&_.verification-card]:max-w-[720px] [&_.verification-card]:rounded-[18px] [&_.verification-card]:border [&_.verification-card]:border-brand-border [&_.verification-card]:bg-brand-paper [&_.verification-card]:p-[clamp(28px,5vw,55px)] [&_.verification-card]:shadow-[14px_16px_0_var(--color-brand-gold)]
  [&_.verification-card_h1]:my-3 [&_.verification-card_h1]:text-[clamp(3rem,7vw,5rem)]
  [&_.verification-code]:my-6 [&_.verification-code]:grid [&_.verification-code]:gap-1.5 [&_.verification-code]:rounded-xl [&_.verification-code]:border [&_.verification-code]:border-dashed [&_.verification-code]:border-brand-green [&_.verification-code]:bg-[#edf3e7] [&_.verification-code]:p-5
  [&_.verification-code_span]:text-[.68rem] [&_.verification-code_span]:tracking-[.16em] [&_.verification-code_strong]:text-3xl
  [&_.verification-steps]:my-6 [&_.verification-steps]:grid [&_.verification-steps]:gap-2.5
  [&_.verification-steps>div]:grid [&_.verification-steps>div]:grid-cols-[34px_1fr] [&_.verification-steps>div]:items-center [&_.verification-steps>div]:gap-3
  [&_.verification-steps_b]:grid [&_.verification-steps_b]:size-[34px] [&_.verification-steps_b]:place-items-center [&_.verification-steps_b]:rounded-full [&_.verification-steps_b]:bg-brand-dark [&_.verification-steps_b]:text-white

  [&_.booking-entry]:relative [&_.booking-entry]:isolate [&_.booking-entry]:grid [&_.booking-entry]:min-h-[calc(100vh-76px)] [&_.booking-entry]:place-items-center [&_.booking-entry]:overflow-hidden [&_.booking-entry]:bg-[radial-gradient(circle_at_14%_12%,rgba(154,151,79,.16),transparent_26%),linear-gradient(145deg,rgba(255,253,245,.96),rgba(245,241,229,.88))] [&_.booking-entry]:px-6 [&_.booking-entry]:py-16
  [&_.booking-entry-card]:w-full [&_.booking-entry-card]:max-w-[720px] [&_.booking-entry-card]:rounded-[22px] [&_.booking-entry-card]:border [&_.booking-entry-card]:border-brand-dark/15 [&_.booking-entry-card]:bg-brand-paper/90 [&_.booking-entry-card]:p-[clamp(32px,5.5vw,58px)] [&_.booking-entry-card]:shadow-2xl [&_.booking-entry-card]:backdrop-blur-md
  [&_.booking-entry_h1]:my-4 [&_.booking-entry_h1]:max-w-[580px] [&_.booking-entry_h1]:text-[clamp(3.2rem,7vw,5.2rem)]
  [&_.booking-entry-intro]:m-0 [&_.booking-entry-intro]:max-w-[600px]
  [&_.booking-entry-actions]:mt-8 [&_.booking-entry-actions]:grid [&_.booking-entry-actions]:grid-cols-[1.35fr_.9fr] [&_.booking-entry-actions]:gap-3
  [&_.booking-entry-primary]:justify-between
  [&_.booking-entry-secondary]:border-brand-dark/35 [&_.booking-entry-secondary]:bg-transparent
  [&_.booking-entry-note]:mt-5 [&_.booking-entry-note]:text-center [&_.booking-entry-note]:text-xs

  [&_.admin-shell]:grid [&_.admin-shell]:min-h-[calc(100vh-76px)] [&_.admin-shell]:grid-cols-[245px_minmax(0,1fr)]
  [&_.admin-nav]:flex [&_.admin-nav]:flex-col [&_.admin-nav]:gap-1 [&_.admin-nav]:bg-brand-dark [&_.admin-nav]:px-6 [&_.admin-nav]:py-8 [&_.admin-nav]:text-white
  [&_.admin-nav_h2]:mb-5 [&_.admin-nav_h2]:text-2xl
  [&_.admin-nav-label]:mt-4 [&_.admin-nav-label]:text-[.62rem] [&_.admin-nav-label]:tracking-[.16em] [&_.admin-nav-label]:text-brand-gold
  [&_.admin-nav_a]:rounded-md [&_.admin-nav_a]:px-3 [&_.admin-nav_a]:py-2.5 [&_.admin-nav_a]:text-sm [&_.admin-nav_a]:text-[#c4d0ca]
  [&_.admin-nav_a:hover]:bg-white/10 [&_.admin-nav_a:hover]:text-white [&_.admin-nav_a.active]:bg-white/10 [&_.admin-nav_a.active]:text-white
  [&_.admin-content]:min-w-0 [&_.admin-content]:px-[clamp(22px,5vw,70px)] [&_.admin-content]:py-11
  [&_.admin-title]:mb-8 [&_.admin-title]:flex [&_.admin-title]:items-start [&_.admin-title]:justify-between
  [&_.admin-title_h1]:my-2 [&_.admin-title_h1]:text-6xl
  [&_.today]:rounded-full [&_.today]:border [&_.today]:border-brand-border [&_.today]:bg-white [&_.today]:px-4 [&_.today]:py-2 [&_.today]:text-sm
  [&_.toolbar]:mb-5 [&_.toolbar]:flex [&_.toolbar]:items-center [&_.toolbar]:justify-between [&_.toolbar]:gap-4
  [&_.timeline]:grid [&_.timeline]:gap-2.5
  [&_.timeline_article]:grid [&_.timeline_article]:grid-cols-[70px_1fr_auto_140px] [&_.timeline_article]:items-center [&_.timeline_article]:gap-4 [&_.timeline_article]:rounded-lg [&_.timeline_article]:border-l-4 [&_.timeline_article]:border-brand-gold [&_.timeline_article]:bg-white [&_.timeline_article]:p-4
  [&_.timeline_time]:text-3xl [&_.timeline_h3]:my-1 [&_.timeline_p]:m-0 [&_.timeline_p]:text-xs
  [&_.small-action]:inline-flex [&_.small-action]:min-h-11 [&_.small-action]:cursor-pointer [&_.small-action]:items-center [&_.small-action]:justify-center [&_.small-action]:rounded-md [&_.small-action]:border [&_.small-action]:border-brand-border [&_.small-action]:bg-white [&_.small-action]:px-3 [&_.small-action]:py-2 [&_.small-action]:text-center [&_.small-action]:text-xs [&_.small-action]:font-semibold
  [&_.small-action:hover]:border-brand-green [&_.small-action:hover]:bg-[#eef3e9]
  [&_.danger-action]:border-red-200 [&_.danger-action]:bg-red-50 [&_.danger-action]:text-brand-danger
  [&_.pay-action]:border-brand-green/30 [&_.pay-action]:bg-[#edf3e7] [&_.pay-action]:text-brand-green
  [&_.admin-form-page]:min-h-[calc(100vh-76px)] [&_.admin-form-page]:bg-[linear-gradient(135deg,#edf1e7,#f4f2e9_55%)] [&_.admin-form-page]:px-[clamp(20px,5vw,64px)] [&_.admin-form-page]:py-11
  [&_.admin-form-container]:mx-auto [&_.admin-form-container]:w-full [&_.admin-form-container]:max-w-[920px]
  [&_.back-link]:inline-flex [&_.back-link]:min-h-11 [&_.back-link]:items-center [&_.back-link]:font-bold [&_.back-link]:text-brand-green [&_.back-link]:underline [&_.back-link]:underline-offset-4
  [&_.admin-form-heading]:mt-8 [&_.admin-form-heading]:mb-7 [&_.admin-form-heading]:max-w-[740px]
  [&_.admin-form-heading_h1]:my-3 [&_.admin-form-heading_h1]:text-[clamp(3.2rem,6vw,5.25rem)]
  [&_.admin-form-heading_p]:m-0 [&_.admin-form-heading_p]:max-w-[680px]
  [&_.form-grid]:grid [&_.form-grid]:max-w-[820px] [&_.form-grid]:grid-cols-2 [&_.form-grid]:gap-4
  [&_.form-grid.three]:grid-cols-6 [&_.form-grid_label]:grid [&_.form-grid_label]:content-start [&_.form-grid_label]:gap-2 [&_.form-grid_label]:text-xs [&_.form-grid_label]:font-bold [&_.form-grid_label]:text-brand-muted
  [&_.form-grid.three_.schedule-field]:col-span-2 [&_.form-grid.three_.financial-field]:col-span-3
  [&_.form-grid_.wide]:col-span-full
  [&_.form-section-title]:mt-2 [&_.form-section-title]:mb-5 [&_.form-section-title]:flex [&_.form-section-title]:items-start [&_.form-section-title]:gap-3 [&_.form-section-title]:border-b [&_.form-section-title]:border-brand-border [&_.form-section-title]:pb-4 [&_.form-section-title]:pt-1
  [&_.form-section-title>span]:grid [&_.form-section-title>span]:size-9 [&_.form-section-title>span]:shrink-0 [&_.form-section-title>span]:place-items-center [&_.form-section-title>span]:rounded-full [&_.form-section-title>span]:bg-brand-dark [&_.form-section-title>span]:text-brand-paper
  [&_.form-section-title_h2]:m-0 [&_.form-section-title_p]:m-0 [&_.form-section-title_p]:text-sm
  [&_.manual-booking-form]:m-0 [&_.manual-booking-form]:w-full [&_.manual-booking-form]:max-w-[920px] [&_.manual-booking-form]:p-8
  [&_.manual-booking-form_.form-grid]:w-full [&_.manual-booking-form_.form-grid]:max-w-none [&_.manual-booking-form_.form-grid]:mb-7
  [&_.booking-mode-switch]:mb-5 [&_.booking-mode-switch]:grid [&_.booking-mode-switch]:grid-cols-2 [&_.booking-mode-switch]:rounded-lg [&_.booking-mode-switch]:border [&_.booking-mode-switch]:border-brand-border [&_.booking-mode-switch]:bg-white
  [&_.booking-mode-switch_button]:min-h-11 [&_.booking-mode-switch_button]:border-0 [&_.booking-mode-switch_button]:border-r [&_.booking-mode-switch_button]:border-brand-border [&_.booking-mode-switch_button]:bg-transparent [&_.booking-mode-switch_button]:px-5 [&_.booking-mode-switch_button]:py-2.5 [&_.booking-mode-switch_button]:text-brand-dark
  [&_.booking-mode-switch_button:last-child]:border-r-0 [&_.booking-mode-switch_button.active]:bg-brand-dark [&_.booking-mode-switch_button.active]:text-white
  [&_.page-mode-switch]:w-full [&_.client-mode-switch]:mt-3 [&_.client-mode-switch]:mb-4 [&_.client-mode-switch]:w-full [&_.client-mode-switch]:max-w-[430px]
  [&_.client-picker-field]:mb-[18px] [&_.client-picker-field]:grid [&_.client-picker-field]:gap-2.5
  [&_.client-picker-field_label]:grid [&_.client-picker-field_label]:gap-[7px] [&_.client-picker-field_label]:text-xs [&_.client-picker-field_label]:font-extrabold [&_.client-picker-field_label]:uppercase [&_.client-picker-field_label]:text-brand-muted
  [&_.client-picker-list]:grid [&_.client-picker-list]:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] [&_.client-picker-list]:gap-2
  [&_.client-picker-list_button]:grid [&_.client-picker-list_button]:min-h-[54px] [&_.client-picker-list_button]:cursor-pointer [&_.client-picker-list_button]:gap-1 [&_.client-picker-list_button]:rounded-[9px] [&_.client-picker-list_button]:border [&_.client-picker-list_button]:border-brand-border [&_.client-picker-list_button]:bg-brand-paper [&_.client-picker-list_button]:px-3 [&_.client-picker-list_button]:py-2.5 [&_.client-picker-list_button]:text-left [&_.client-picker-list_button]:text-brand-dark
  [&_.client-picker-list_button.selected]:border-brand-green [&_.client-picker-list_button.selected]:bg-[#edf2e7] [&_.client-picker-list_button.selected]:shadow-[0_0_0_2px_rgba(83,111,67,.14)]
  [&_.client-picker-list_b]:text-base [&_.client-picker-list_span]:text-xs [&_.client-picker-list_span]:text-brand-muted [&_.client-picker-list_p]:m-0 [&_.client-picker-list_p]:text-xs
  [&_.slot-field_small]:min-h-[1.1em] [&_.slot-field_small]:text-[.7rem] [&_.slot-field_small]:font-semibold [&_.slot-field_small]:normal-case [&_.slot-field_small]:text-brand-muted [&_.slot-field_.slot-error]:text-brand-danger
  [&_.manual-total]:my-5 [&_.manual-total]:flex [&_.manual-total]:min-h-[82px] [&_.manual-total]:items-center [&_.manual-total]:justify-between [&_.manual-total]:gap-5 [&_.manual-total]:rounded-xl [&_.manual-total]:bg-brand-dark [&_.manual-total]:px-5 [&_.manual-total]:py-4 [&_.manual-total]:text-brand-paper
  [&_.manual-total_span]:font-body [&_.manual-total_span]:text-sm [&_.manual-total_span]:font-bold [&_.manual-total_strong]:whitespace-nowrap [&_.manual-total_strong]:text-3xl [&_.manual-total_strong]:leading-none [&_.manual-total_strong]:text-brand-paper [&_.manual-total_strong]:tabular-nums
  [&_.manual-success]:mx-0 [&_.manual-success]:max-w-[680px] [&_.manual-success]:p-10 [&_.manual-success]:text-center
  [&_.manual-success_.actions]:justify-center
  [&_.metric-grid]:mb-8 [&_.metric-grid]:grid [&_.metric-grid]:grid-cols-3 [&_.metric-grid]:gap-3
  [&_.metric-grid_article]:grid [&_.metric-grid_article]:min-h-32 [&_.metric-grid_article]:rounded-xl [&_.metric-grid_article]:bg-brand-dark [&_.metric-grid_article]:p-5 [&_.metric-grid_article]:text-white
  [&_.metric-grid_b]:text-4xl
  [&_.table]:overflow-hidden [&_.table]:rounded-xl [&_.table]:border [&_.table]:border-brand-border [&_.table]:bg-white
  [&_.table>div]:grid [&_.table>div]:grid-cols-[2fr_1.2fr_1fr_auto] [&_.table>div]:items-center [&_.table>div]:gap-4 [&_.table>div]:border-b [&_.table>div]:border-brand-border [&_.table>div]:p-4 [&_.table>div]:text-sm
  [&_.cash-form]:mb-5 [&_.cash-form]:grid [&_.cash-form]:grid-cols-[150px_180px_150px_1fr_auto] [&_.cash-form]:gap-3

  [&_.dashboard-page]:mx-auto [&_.dashboard-page]:w-full [&_.dashboard-page]:max-w-[1440px] [&_.dashboard-page]:px-[clamp(20px,5vw,70px)] [&_.dashboard-page]:py-12
  [&_.dashboard-heading]:mb-8 [&_.dashboard-heading]:flex [&_.dashboard-heading]:items-end [&_.dashboard-heading]:justify-between [&_.dashboard-heading]:gap-6
  [&_.dashboard-heading_h1]:my-2 [&_.dashboard-heading_h1]:text-[clamp(3rem,6vw,5.5rem)]
  [&_.dashboard-actions]:flex [&_.dashboard-actions]:flex-wrap [&_.dashboard-actions]:gap-2
  [&_.admin-shortcuts]:mb-6 [&_.admin-shortcuts]:flex [&_.admin-shortcuts]:flex-wrap [&_.admin-shortcuts]:gap-2
  [&_.admin-shortcuts_a]:rounded-full [&_.admin-shortcuts_a]:border [&_.admin-shortcuts_a]:border-brand-border [&_.admin-shortcuts_a]:bg-white [&_.admin-shortcuts_a]:px-4 [&_.admin-shortcuts_a]:py-2 [&_.admin-shortcuts_a]:text-sm
  [&_.period-panel]:mb-6 [&_.period-panel]:flex [&_.period-panel]:items-center [&_.period-panel]:justify-between [&_.period-panel]:gap-4 [&_.period-panel]:rounded-xl [&_.period-panel]:border [&_.period-panel]:border-brand-border [&_.period-panel]:bg-white [&_.period-panel]:p-4
  [&_.period-pills]:flex [&_.period-pills]:flex-wrap [&_.period-pills]:gap-2
  [&_.period-pills_button]:rounded-full [&_.period-pills_button]:border [&_.period-pills_button]:border-brand-border [&_.period-pills_button]:bg-transparent [&_.period-pills_button]:px-4 [&_.period-pills_button]:py-2
  [&_.period-pills_button.active]:border-brand-green [&_.period-pills_button.active]:bg-brand-green [&_.period-pills_button.active]:text-white
  [&_.dashboard-metrics]:mb-8 [&_.dashboard-metrics]:grid [&_.dashboard-metrics]:grid-cols-6 [&_.dashboard-metrics]:gap-3
  [&_.metric-card]:relative [&_.metric-card]:flex [&_.metric-card]:min-h-[145px] [&_.metric-card]:flex-col [&_.metric-card]:rounded-xl [&_.metric-card]:border [&_.metric-card]:border-brand-border [&_.metric-card]:bg-white [&_.metric-card]:p-5
  [&_.metric-card.featured]:bg-brand-dark [&_.metric-card.featured]:text-white [&_.metric-card>b]:text-4xl
  [&_.metric-card.negative]:border-red-200 [&_.metric-card.negative]:bg-red-50
  [&_.metric-card>b]:mt-auto [&_.metric-card>b]:leading-none [&_.metric-card>small]:mt-1.5 [&_.metric-card>small]:text-[.66rem] [&_.metric-card>small]:text-brand-muted
  [&_.metric-progress]:mt-3 [&_.metric-progress]:block [&_.metric-progress]:h-1 [&_.metric-progress]:overflow-hidden [&_.metric-progress]:rounded [&_.metric-progress]:bg-white/15
  [&_.metric-progress_i]:block [&_.metric-progress_i]:h-full [&_.metric-progress_i]:bg-brand-gold
  [&_.dashboard-grid]:grid [&_.dashboard-grid]:grid-cols-2 [&_.dashboard-grid]:gap-4
  [&_.section-heading]:mb-5 [&_.section-heading]:flex [&_.section-heading]:items-start [&_.section-heading]:justify-between [&_.section-heading]:gap-4
  [&_.section-heading_h2]:my-1 [&_.section-heading_h2]:text-3xl
  [&_.admin-slots]:grid [&_.admin-slots]:grid-cols-[repeat(auto-fit,minmax(118px,1fr))] [&_.admin-slots]:gap-2.5
  [&_.admin-slots_button]:grid [&_.admin-slots_button]:min-h-[88px] [&_.admin-slots_button]:min-w-0 [&_.admin-slots_button]:place-content-center [&_.admin-slots_button]:gap-1.5 [&_.admin-slots_button]:rounded-lg [&_.admin-slots_button]:border [&_.admin-slots_button]:border-brand-border [&_.admin-slots_button]:bg-white [&_.admin-slots_button]:p-3 [&_.admin-slots_button]:text-center
  [&_.admin-slots_button:not(:disabled):hover]:border-brand-green [&_.admin-slots_button:not(:disabled):hover]:bg-brand-green [&_.admin-slots_button:not(:disabled):hover]:text-white
  [&_.admin-slots_.slot-time]:text-2xl [&_.admin-slots_.slot-time]:leading-none [&_.admin-slots_.slot-state]:font-body [&_.admin-slots_.slot-state]:text-[.68rem] [&_.admin-slots_.slot-state]:font-bold [&_.admin-slots_.slot-state]:leading-tight

  [&_.operations-dashboard]:bg-[linear-gradient(180deg,#e8eee1_0,#f4f2e9_330px)]
  [&_.operations-heading]:items-center [&_.operations-heading_h1]:mb-2
  [&_.operations-date]:mt-3 [&_.operations-date]:block [&_.operations-date]:font-display [&_.operations-date]:text-base [&_.operations-date]:font-medium [&_.operations-date]:capitalize [&_.operations-date]:text-brand-green
  [&_.operations-actions]:justify-end
  [&_.operations-nav]:max-w-[760px]
  [&_.advanced-menu]:mb-6 [&_.advanced-menu]:rounded-lg [&_.advanced-menu]:border [&_.advanced-menu]:border-brand-border [&_.advanced-menu]:bg-brand-paper/70
  [&_.advanced-menu_summary]:min-h-11 [&_.advanced-menu_summary]:cursor-pointer [&_.advanced-menu_summary]:px-4 [&_.advanced-menu_summary]:py-3 [&_.advanced-menu_summary]:font-display [&_.advanced-menu_summary]:text-sm [&_.advanced-menu_summary]:font-medium [&_.advanced-menu_summary]:text-brand-dark
  [&_.advanced-menu_nav]:flex [&_.advanced-menu_nav]:flex-wrap [&_.advanced-menu_nav]:gap-2 [&_.advanced-menu_nav]:px-4 [&_.advanced-menu_nav]:pb-4
  [&_.advanced-menu_a]:inline-flex [&_.advanced-menu_a]:min-h-11 [&_.advanced-menu_a]:items-center [&_.advanced-menu_a]:rounded-md [&_.advanced-menu_a]:border [&_.advanced-menu_a]:border-brand-border [&_.advanced-menu_a]:bg-white [&_.advanced-menu_a]:px-3 [&_.advanced-menu_a]:py-2 [&_.advanced-menu_a]:text-xs
  [&_.operations-summary]:my-8 [&_.operations-summary]:grid [&_.operations-summary]:grid-cols-4 [&_.operations-summary]:gap-3
  [&_.operations-summary_article]:flex [&_.operations-summary_article]:min-h-[116px] [&_.operations-summary_article]:min-w-0 [&_.operations-summary_article]:flex-col [&_.operations-summary_article]:rounded-xl [&_.operations-summary_article]:border [&_.operations-summary_article]:border-brand-border [&_.operations-summary_article]:bg-brand-paper [&_.operations-summary_article]:p-5 [&_.operations-summary_article]:shadow-[0_8px_24px_rgba(34,53,38,.045)]
  [&_.summary-label]:font-body [&_.summary-label]:text-xs [&_.summary-label]:font-bold [&_.summary-label]:text-brand-muted
  [&_.summary-value]:mt-auto [&_.summary-value]:whitespace-nowrap [&_.summary-value]:font-display [&_.summary-value]:text-[clamp(1.65rem,2.4vw,2.35rem)] [&_.summary-value]:font-medium [&_.summary-value]:leading-none [&_.summary-value]:text-brand-dark [&_.summary-value]:tabular-nums
  [&_.operations-agenda]:mb-9
  [&_.operations-agenda-heading]:items-end
  [&_.operations-date-picker]:grid [&_.operations-date-picker]:w-[180px] [&_.operations-date-picker]:shrink-0 [&_.operations-date-picker]:gap-1.5 [&_.operations-date-picker]:font-body [&_.operations-date-picker]:text-xs [&_.operations-date-picker]:font-bold [&_.operations-date-picker]:text-brand-muted
  [&_.operations-bookings]:mt-4 [&_.operations-bookings]:grid [&_.operations-bookings]:gap-2.5
  [&_.operations-booking]:grid [&_.operations-booking]:grid-cols-[86px_minmax(0,1fr)_minmax(205px,auto)] [&_.operations-booking]:items-center [&_.operations-booking]:gap-4 [&_.operations-booking]:rounded-xl [&_.operations-booking]:border [&_.operations-booking]:border-brand-border [&_.operations-booking]:border-l-[5px] [&_.operations-booking]:border-l-brand-green [&_.operations-booking]:bg-brand-paper [&_.operations-booking]:px-5 [&_.operations-booking]:py-[18px] [&_.operations-booking]:shadow-[0_6px_18px_rgba(34,53,38,.045)]
  [&_.operations-booking.cancelled]:border-l-[#b8b8b1] [&_.operations-booking.cancelled]:bg-[#f0efe9] [&_.operations-booking.cancelled]:opacity-65
  [&_.operations-booking.blocked]:border-l-brand-gold [&_.operations-booking.blocked]:bg-[#f4f1df]
  [&_.operations-booking>time]:grid [&_.operations-booking>time]:leading-none
  [&_.operations-booking>time>b]:text-[2.15rem] [&_.operations-booking>time>b]:font-semibold [&_.operations-booking>time>b]:text-brand-dark
  [&_.operations-booking>time>small]:mt-1.5 [&_.operations-booking>time>small]:font-body [&_.operations-booking>time>small]:text-[.68rem] [&_.operations-booking>time>small]:font-semibold [&_.operations-booking>time>small]:text-brand-muted
  [&_.operations-booking-main]:min-w-0 [&_.operations-booking-main_h3]:my-1.5 [&_.operations-booking-main_h3]:text-xl [&_.operations-booking-main_p]:m-0 [&_.operations-booking-main_p]:break-words [&_.operations-booking-main_p]:text-xs
  [&_.operations-booking-labels]:flex [&_.operations-booking-labels]:flex-wrap [&_.operations-booking-labels]:items-center [&_.operations-booking-labels]:gap-1.5
  [&_.operations-booking-actions]:flex [&_.operations-booking-actions]:flex-wrap [&_.operations-booking-actions]:justify-end [&_.operations-booking-actions]:gap-1.5
  [&_.status-pill]:inline-flex [&_.status-pill]:rounded-full [&_.status-pill]:px-2 [&_.status-pill]:py-1 [&_.status-pill]:font-display [&_.status-pill]:text-[.62rem] [&_.status-pill]:font-semibold [&_.status-pill]:uppercase [&_.status-pill]:tracking-[.06em]
  [&_.origin-pill]:inline-flex [&_.origin-pill]:rounded-full [&_.origin-pill]:border [&_.origin-pill]:border-brand-border [&_.origin-pill]:px-2 [&_.origin-pill]:py-1 [&_.origin-pill]:font-display [&_.origin-pill]:text-[.62rem] [&_.origin-pill]:font-semibold [&_.origin-pill]:uppercase [&_.origin-pill]:tracking-[.06em] [&_.origin-pill]:text-brand-muted
  [&_.payment-pill]:inline-flex [&_.payment-pill]:rounded-full [&_.payment-pill]:bg-[#f5e9be] [&_.payment-pill]:px-2 [&_.payment-pill]:py-1 [&_.payment-pill]:font-display [&_.payment-pill]:text-[.62rem] [&_.payment-pill]:font-semibold [&_.payment-pill]:uppercase [&_.payment-pill]:tracking-[.06em] [&_.payment-pill]:text-[#76611b]
  [&_.payment-pill.paid]:bg-[#dcebd9] [&_.payment-pill.paid]:text-[#376044]
  [&_.status-confirmed]:bg-[#dfebdc] [&_.status-confirmed]:text-[#326044] [&_.status-reserved]:bg-[#dfebdc] [&_.status-reserved]:text-[#326044] [&_.status-cancelled]:bg-[#e7e5df] [&_.status-cancelled]:text-[#77766f] [&_.status-blocked]:bg-[#e7e1bd] [&_.status-blocked]:text-[#5f5b2f] [&_.status-played]:bg-[#dfe9df] [&_.status-played]:text-[#3d6547] [&_.status-no_show]:bg-[#f1ded9] [&_.status-no_show]:text-[#934d42]
  [&_.availability-controls]:flex [&_.availability-controls]:items-end [&_.availability-controls]:gap-2
  [&_.availability-duration]:grid [&_.availability-duration]:w-[150px] [&_.availability-duration]:gap-1.5 [&_.availability-duration]:font-body [&_.availability-duration]:text-xs [&_.availability-duration]:font-bold [&_.availability-duration]:text-brand-muted
  [&_.section-help]:mt-0 [&_.section-help]:mb-4 [&_.section-help]:max-w-[820px] [&_.section-help]:text-sm
  [&_.operations-slots_button.occupied]:border-[#d0d0ca] [&_.operations-slots_button.occupied]:bg-[#ecebe5]
  [&_.operations-slots_button.blocked]:border-[#b7ae69] [&_.operations-slots_button.blocked]:bg-[#e7e1bd]
  [&_.operations-slots_button.past]:border-[#d8d7d1] [&_.operations-slots_button.past]:bg-[#efeee9] [&_.operations-slots_button.past]:opacity-65
  [&_.operations-slots_button.duration-gap]:border-[#d2c78d] [&_.operations-slots_button.duration-gap]:bg-[#f4efd9]
  [&_.chart-card]:min-h-[310px] [&_.chart-card>h2]:mb-5
  [&_.vertical-chart]:flex [&_.vertical-chart]:h-[210px] [&_.vertical-chart]:items-end [&_.vertical-chart]:gap-2 [&_.vertical-chart]:border-b [&_.vertical-chart]:border-brand-border [&_.vertical-chart]:pt-6
  [&_.chart-column]:flex [&_.chart-column]:h-full [&_.chart-column]:min-w-[15px] [&_.chart-column]:flex-1 [&_.chart-column]:flex-col [&_.chart-column]:items-center [&_.chart-column]:justify-end [&_.chart-column]:text-center
  [&_.chart-column>i]:block [&_.chart-column>i]:min-h-[3px] [&_.chart-column>i]:w-[min(30px,75%)] [&_.chart-column>i]:rounded-t-md [&_.chart-column>i]:bg-brand-green
  [&_.chart-column_small]:mt-1.5 [&_.chart-column_small]:whitespace-nowrap [&_.chart-column_small]:text-[.55rem] [&_.chart-column_small]:text-brand-muted
  [&_.chart-value]:mb-1 [&_.chart-value]:text-[.6rem]
  [&_.horizontal-chart]:grid [&_.horizontal-chart]:gap-3 [&_.horizontal-chart_header]:flex [&_.horizontal-chart_header]:justify-between
  [&_.horizontal-chart_i]:block [&_.horizontal-chart_i]:h-2 [&_.horizontal-chart_i]:overflow-hidden [&_.horizontal-chart_i]:rounded-full [&_.horizontal-chart_i]:bg-brand-green/10
  [&_.horizontal-chart_i_i]:block [&_.horizontal-chart_i_i]:h-full [&_.horizontal-chart_i_i]:bg-brand-green
  [&_.ranking-list]:grid [&_.ranking-list]:gap-3 [&_.ranking-list>div]:grid [&_.ranking-list>div]:grid-cols-[25px_48px_1fr_25px] [&_.ranking-list>div]:items-center [&_.ranking-list>div]:gap-2
  [&_.ranking-list>div>span]:grid [&_.ranking-list>div>span]:size-[22px] [&_.ranking-list>div>span]:place-items-center [&_.ranking-list>div>span]:rounded-full [&_.ranking-list>div>span]:bg-[#edf1e9] [&_.ranking-list>div>span]:text-[.65rem]
  [&_.ranking-list_i]:block [&_.ranking-list_i]:h-[7px] [&_.ranking-list_i]:overflow-hidden [&_.ranking-list_i]:rounded-full [&_.ranking-list_i]:bg-[#e3e8df]
  [&_.ranking-list_i_i]:block [&_.ranking-list_i_i]:h-full [&_.ranking-list_i_i]:rounded-full [&_.ranking-list_i_i]:bg-brand-green [&_.ranking-list_strong]:text-right
  [&_.duration-chart]:grid [&_.duration-chart]:gap-4 [&_.duration-chart>div]:grid [&_.duration-chart>div]:grid-cols-[45px_1fr_70px] [&_.duration-chart>div]:items-center [&_.duration-chart>div]:gap-2
  [&_.duration-chart_i]:block [&_.duration-chart_i]:h-[7px] [&_.duration-chart_i]:overflow-hidden [&_.duration-chart_i]:rounded-full [&_.duration-chart_i]:bg-[#e3e8df]
  [&_.duration-chart_i_i]:block [&_.duration-chart_i_i]:h-full [&_.duration-chart_i_i]:rounded-full [&_.duration-chart_i_i]:bg-brand-green [&_.duration-chart_span]:text-[.66rem] [&_.duration-chart_span]:text-brand-muted
  [&_.finance-mini]:mt-6 [&_.finance-mini]:!flex [&_.finance-mini]:justify-between [&_.finance-mini]:border-t [&_.finance-mini]:border-brand-border [&_.finance-mini]:pt-[18px]
  [&_.finance-mini_span]:grid [&_.finance-mini_span]:text-[.65rem] [&_.finance-mini_span]:text-brand-muted [&_.finance-mini_b]:text-xl [&_.finance-mini_b]:text-brand-dark

  [&_.clients-admin-shell]:bg-[linear-gradient(180deg,#e8eee1_0,#f4f2e9_330px)]
  [&_.clients-admin-content]:grid [&_.clients-admin-content]:content-start [&_.clients-admin-content]:gap-[18px]
  [&_.clients-header]:mb-2 [&_.clients-header]:flex [&_.clients-header]:items-end [&_.clients-header]:justify-between [&_.clients-header]:gap-5
  [&_.clients-header_h1]:my-2 [&_.clients-header_h1]:text-[clamp(3rem,5vw,4.9rem)]
  [&_.clients-header_p]:m-0 [&_.clients-header_p]:max-w-[560px]
  [&_.clients-toolbar]:mb-1 [&_.clients-toolbar]:grid [&_.clients-toolbar]:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] [&_.clients-toolbar]:items-end [&_.clients-toolbar]:gap-[18px] [&_.clients-toolbar]:p-[18px]
  [&_.clients-search]:grid [&_.clients-search]:min-w-0 [&_.clients-search]:gap-2 [&_.clients-search]:font-body [&_.clients-search]:text-xs [&_.clients-search]:font-bold [&_.clients-search]:text-brand-muted
  [&_.client-tabs]:flex [&_.client-tabs]:min-w-0 [&_.client-tabs]:flex-wrap [&_.client-tabs]:justify-end [&_.client-tabs]:gap-1.5 [&_.client-tabs]:rounded-xl [&_.client-tabs]:border [&_.client-tabs]:border-brand-border [&_.client-tabs]:bg-[#edf2e8] [&_.client-tabs]:p-1
  [&_.client-tabs_button]:inline-flex [&_.client-tabs_button]:min-h-[46px] [&_.client-tabs_button]:min-w-0 [&_.client-tabs_button]:items-center [&_.client-tabs_button]:justify-center [&_.client-tabs_button]:gap-2 [&_.client-tabs_button]:rounded-lg [&_.client-tabs_button]:border-0 [&_.client-tabs_button]:bg-transparent [&_.client-tabs_button]:px-3 [&_.client-tabs_button]:py-2 [&_.client-tabs_button]:text-brand-muted
  [&_.client-tabs_button.active]:bg-brand-dark [&_.client-tabs_button.active]:text-white [&_.client-tabs_button.active]:shadow-[0_5px_14px_rgba(34,53,38,.14)]
  [&_.client-tab-label]:whitespace-nowrap [&_.client-tab-label]:text-[.76rem] [&_.client-tab-label]:font-semibold
  [&_.client-tab-count]:inline-grid [&_.client-tab-count]:min-w-8 [&_.client-tab-count]:place-items-center [&_.client-tab-count]:rounded-full [&_.client-tab-count]:bg-white [&_.client-tab-count]:px-2 [&_.client-tab-count]:py-1 [&_.client-tab-count]:text-[.7rem] [&_.client-tab-count]:leading-none [&_.client-tab-count]:text-brand-dark [&_.client-tab-count]:tabular-nums
  [&_.client-form]:p-5 [&_.client-form-actions]:mt-4 [&_.client-form-actions]:flex [&_.client-form-actions]:justify-end [&_.client-form-actions]:gap-2
  [&_.clients-list]:grid [&_.clients-list]:gap-3
  [&_.client-row]:grid [&_.client-row]:grid-cols-[54px_minmax(0,1fr)_auto] [&_.client-row]:items-center [&_.client-row]:gap-4 [&_.client-row]:rounded-xl [&_.client-row]:border [&_.client-row]:border-brand-border [&_.client-row]:bg-white [&_.client-row]:p-4 [&_.client-row]:shadow-[0_5px_18px_rgba(34,53,38,.045)]
  [&_.client-row.inactive]:bg-[#f0efe9] [&_.client-row.inactive]:opacity-70 [&_.client-row.blocked]:border-l-[5px] [&_.client-row.blocked]:border-l-brand-danger [&_.client-row.blocked]:bg-red-50
  [&_.client-avatar]:grid [&_.client-avatar]:size-[54px] [&_.client-avatar]:place-items-center [&_.client-avatar]:rounded-full [&_.client-avatar]:bg-brand-dark [&_.client-avatar]:text-xl [&_.client-avatar]:text-white
  [&_.client-main]:min-w-0 [&_.client-main_p]:mt-1 [&_.client-main_p]:mb-0 [&_.client-main_p]:break-words [&_.client-main_p]:text-xs
  [&_.client-title-row]:flex [&_.client-title-row]:flex-wrap [&_.client-title-row]:items-center [&_.client-title-row]:gap-2 [&_.client-title-row_h2]:m-0 [&_.client-title-row_h2]:text-xl
  [&_.client-status]:inline-flex [&_.client-status]:rounded-full [&_.client-status]:px-2 [&_.client-status]:py-1 [&_.client-status]:font-display [&_.client-status]:text-[.62rem] [&_.client-status]:font-semibold [&_.client-status]:uppercase [&_.client-status]:tracking-[.06em]
  [&_.client-status.pending]:bg-[#fff0c9] [&_.client-status.pending]:text-[#775d17] [&_.client-status.confirmed]:bg-[#dfebdc] [&_.client-status.confirmed]:text-[#326044] [&_.client-status.inactive]:bg-[#e4e3dd] [&_.client-status.inactive]:text-[#767d76] [&_.client-status.blocked]:bg-[#f1ded9] [&_.client-status.blocked]:text-[#934d42]
  [&_.client-actions]:flex [&_.client-actions]:max-w-[390px] [&_.client-actions]:flex-wrap [&_.client-actions]:justify-end [&_.client-actions]:gap-1.5

  [&_.security-page]:mx-auto [&_.security-page]:w-full [&_.security-page]:max-w-[1400px] [&_.security-page]:px-[clamp(20px,5vw,70px)] [&_.security-page]:py-12
  [&_.security-head]:mb-8 [&_.security-head]:flex [&_.security-head]:items-end [&_.security-head]:justify-between [&_.security-head]:gap-5
  [&_.security-head_h1]:my-2 [&_.security-head_h1]:text-6xl
  [&_.security-grid]:grid [&_.security-grid]:grid-cols-2 [&_.security-grid]:gap-4
  [&_.security-panel]:rounded-xl [&_.security-panel]:border [&_.security-panel]:border-brand-border [&_.security-panel]:bg-white [&_.security-panel]:p-5
  [&_.panel-title]:mb-4 [&_.panel-title]:flex [&_.panel-title]:items-start [&_.panel-title]:justify-between [&_.panel-title]:gap-3
  [&_.panel-title_h2]:my-1 [&_.panel-title_h2]:text-3xl
  [&_.count]:grid [&_.count]:size-9 [&_.count]:place-items-center [&_.count]:rounded-full [&_.count]:bg-brand-dark [&_.count]:text-white
  [&_.request-list]:grid [&_.request-list]:gap-3 [&_.request-card]:rounded-lg [&_.request-card]:border [&_.request-card]:border-brand-border [&_.request-card]:bg-brand-cream/50 [&_.request-card]:p-4
  [&_.request-card_h3]:m-0 [&_.request-card_p]:my-1 [&_.request-card_p]:text-sm
  [&_.code]:my-2 [&_.code]:inline-flex [&_.code]:rounded-md [&_.code]:bg-brand-dark [&_.code]:px-3 [&_.code]:py-2 [&_.code]:font-mono [&_.code]:text-sm [&_.code]:text-brand-paper
  [&_.card-actions]:mt-3 [&_.card-actions]:flex [&_.card-actions]:flex-wrap [&_.card-actions]:gap-2
  [&_.safety-note]:col-span-full [&_.safety-note]:rounded-xl [&_.safety-note]:border-l-4 [&_.safety-note]:border-brand-gold [&_.safety-note]:bg-brand-dark [&_.safety-note]:p-5 [&_.safety-note]:text-white [&_.safety-note_p]:m-0 [&_.safety-note_p]:text-brand-cream/75
  [&_.audit-panel]:col-span-full
  [&_.panel-title-actions]:flex [&_.panel-title-actions]:items-center [&_.panel-title-actions]:gap-2
  [&_.refresh-action]:cursor-pointer [&_.refresh-action]:rounded-full [&_.refresh-action]:border [&_.refresh-action]:border-brand-border [&_.refresh-action]:bg-transparent [&_.refresh-action]:px-3 [&_.refresh-action]:py-2 [&_.refresh-action]:text-xs [&_.refresh-action]:font-extrabold
  [&_.refresh-action:hover]:bg-[#edf2e7]
  [&_.inline-retry]:cursor-pointer [&_.inline-retry]:border-0 [&_.inline-retry]:bg-transparent [&_.inline-retry]:p-0 [&_.inline-retry]:font-extrabold [&_.inline-retry]:text-brand-green [&_.inline-retry]:underline
  [&_.modal-form]:grid [&_.modal-form]:gap-3 [&_.modal-form_label]:grid [&_.modal-form_label]:gap-1.5 [&_.modal-form_label]:text-xs [&_.modal-form_label]:font-bold [&_.modal-form_label]:text-brand-muted
  [&_.expected]:my-4 [&_.expected]:grid [&_.expected]:grid-cols-2 [&_.expected]:gap-2
  [&_.expected_div]:grid [&_.expected_div]:rounded-lg [&_.expected_div]:bg-[#edf2e7] [&_.expected_div]:p-3
  [&_.expected_span]:text-[.6rem] [&_.expected_span]:tracking-[.1em] [&_.expected_span]:text-brand-muted [&_.expected_strong]:text-base
  [&_.confirmation]:!flex [&_.confirmation]:items-start [&_.confirmation_input]:mt-1 [&_.confirmation_input]:!w-auto
  [&_.modal-actions]:mt-2 [&_.modal-actions]:grid [&_.modal-actions]:grid-cols-2 [&_.modal-actions]:gap-2

  [&_.stories-shell]:bg-[#eef1e8] [&_.stories-content]:grid [&_.stories-content]:gap-[18px]
  [&_.stories-header]:flex [&_.stories-header]:items-end [&_.stories-header]:justify-between [&_.stories-header]:gap-6 [&_.stories-header]:border-b [&_.stories-header]:border-brand-border [&_.stories-header]:pb-[18px]
  [&_.stories-header_h1]:my-1.5 [&_.stories-header_h1]:text-[3.2rem] [&_.stories-header_p]:m-0 [&_.stories-header_p]:max-w-[620px]
  [&_.stories-header-actions]:flex [&_.stories-header-actions]:flex-wrap [&_.stories-header-actions]:items-center [&_.stories-header-actions]:justify-end [&_.stories-header-actions]:gap-3
  [&_.booking-destination]:grid [&_.booking-destination]:min-w-44 [&_.booking-destination]:gap-px [&_.booking-destination]:border-l-[3px] [&_.booking-destination]:border-[#a9bd31] [&_.booking-destination]:bg-brand-paper [&_.booking-destination]:px-3 [&_.booking-destination]:py-2 [&_.booking-destination_small]:text-[.62rem] [&_.booking-destination_small]:font-extrabold
  [&_.story-workbench]:grid [&_.story-workbench]:grid-cols-[minmax(320px,400px)_minmax(380px,1fr)] [&_.story-workbench]:items-start [&_.story-workbench]:gap-6
  [&_.story-controls]:sticky [&_.story-controls]:top-[92px] [&_.story-controls]:grid [&_.story-controls]:content-start [&_.story-controls]:overflow-hidden [&_.story-controls]:rounded-lg [&_.story-controls]:bg-brand-paper
  [&_.story-controls_label]:grid [&_.story-controls_label]:gap-[7px] [&_.story-controls_label]:text-[.7rem] [&_.story-controls_label]:font-extrabold [&_.story-controls_label]:uppercase [&_.story-controls_label]:text-brand-muted
  [&_.story-controls_small]:text-[.68rem] [&_.story-controls_small]:normal-case [&_.story-controls_small]:leading-[1.45] [&_.story-controls_small]:text-brand-muted
  [&_.control-section]:grid [&_.control-section]:gap-3 [&_.control-section]:border-b [&_.control-section]:border-brand-border [&_.control-section]:px-5 [&_.control-section]:py-[18px]
  [&_.control-section:last-child]:border-0
  [&_.control-kicker]:text-xs [&_.control-kicker]:font-bold [&_.control-kicker]:tracking-[.14em] [&_.control-kicker]:text-brand-gold
  [&_.control-grid]:grid [&_.control-grid]:grid-cols-2 [&_.control-grid]:gap-3
  [&_.template-picker]:grid [&_.template-picker]:grid-cols-3 [&_.template-picker]:gap-[7px]
  [&_.template-picker_button]:grid [&_.template-picker_button]:min-h-[92px] [&_.template-picker_button]:cursor-pointer [&_.template-picker_button]:content-start [&_.template-picker_button]:gap-1 [&_.template-picker_button]:rounded-md [&_.template-picker_button]:border [&_.template-picker_button]:border-brand-border [&_.template-picker_button]:bg-[#f7f6ef] [&_.template-picker_button]:p-3 [&_.template-picker_button]:text-left
  [&_.template-picker_button.active]:border-brand-dark [&_.template-picker_button.active]:bg-brand-dark [&_.template-picker_button.active]:text-brand-paper [&_.template-picker_button.active]:shadow-[inset_0_-4px_#a9bd31]
  [&_.template-picker_span]:text-[.64rem] [&_.template-picker_span]:leading-[1.35] [&_.template-picker_span]:opacity-70
  [&_.color-grid]:grid [&_.color-grid]:grid-cols-3 [&_.color-grid]:gap-2.5 [&_.color-grid_input]:h-10 [&_.color-grid_input]:p-[3px]
  [&_.asset-gallery]:grid [&_.asset-gallery]:grid-cols-2 [&_.asset-gallery]:gap-2
  [&_.asset-gallery_button]:grid [&_.asset-gallery_button]:cursor-pointer [&_.asset-gallery_button]:gap-[7px] [&_.asset-gallery_button]:rounded-md [&_.asset-gallery_button]:border [&_.asset-gallery_button]:border-brand-border [&_.asset-gallery_button]:bg-[#f7f6ef] [&_.asset-gallery_button]:p-[7px] [&_.asset-gallery_button]:text-left
  [&_.asset-gallery_button.active]:border-brand-green [&_.asset-gallery_button.active]:shadow-[0_0_0_2px_rgba(83,111,67,.18)]
  [&_.asset-gallery_img]:aspect-[9/12] [&_.asset-gallery_img]:w-full [&_.asset-gallery_img]:rounded [&_.asset-gallery_img]:bg-[#d9dfd2] [&_.asset-gallery_img]:object-cover
  [&_.asset-gallery_span]:overflow-hidden [&_.asset-gallery_span]:text-ellipsis [&_.asset-gallery_span]:whitespace-nowrap [&_.asset-gallery_span]:text-[.68rem] [&_.asset-gallery_span]:text-brand-muted
  [&_.story-preview-panel]:grid [&_.story-preview-panel]:min-w-0 [&_.story-preview-panel]:gap-3.5 [&_.story-preview-panel]:rounded-lg [&_.story-preview-panel]:bg-[#dfe5da] [&_.story-preview-panel]:p-5
  [&_.preview-toolbar]:flex [&_.preview-toolbar]:items-end [&_.preview-toolbar]:justify-between [&_.preview-toolbar]:gap-4 [&_.preview-toolbar]:border-b [&_.preview-toolbar]:border-brand-border [&_.preview-toolbar]:pb-3
  [&_.preview-toolbar_h2]:mt-1 [&_.preview-toolbar_h2]:mb-0 [&_.preview-toolbar_h2]:text-2xl [&_.preview-toolbar>span]:text-xs [&_.preview-toolbar>span]:font-extrabold [&_.preview-toolbar>span]:uppercase
  [&_.phone-frame]:mx-auto [&_.phone-frame]:w-full [&_.phone-frame]:max-w-[430px] [&_.phone-frame]:overflow-hidden [&_.phone-frame]:rounded-lg [&_.phone-frame]:bg-[#17251b] [&_.phone-frame]:p-2.5 [&_.phone-frame]:shadow-2xl
  [&_.phone-frame_canvas]:block [&_.phone-frame_canvas]:h-auto [&_.phone-frame_canvas]:w-full [&_.phone-frame_canvas]:rounded
  [&_.slot-strip]:mx-auto [&_.slot-strip]:flex [&_.slot-strip]:w-full [&_.slot-strip]:max-w-[520px] [&_.slot-strip]:flex-wrap [&_.slot-strip]:justify-center [&_.slot-strip]:gap-[7px] [&_.slot-strip]:text-brand-muted
  [&_.slot-strip_b]:inline-flex [&_.slot-strip_b]:min-h-[30px] [&_.slot-strip_b]:items-center [&_.slot-strip_b]:rounded [&_.slot-strip_b]:border [&_.slot-strip_b]:border-brand-border [&_.slot-strip_b]:bg-brand-paper [&_.slot-strip_b]:px-[9px] [&_.slot-strip_b]:py-[5px] [&_.slot-strip_b]:text-xs

  max-[1024px]:[&_.admin-shell]:grid-cols-[210px_minmax(0,1fr)] max-[1024px]:[&_.clients-toolbar]:grid-cols-1 max-[1024px]:[&_.client-tabs]:justify-start
  max-[1100px]:[&_.dashboard-metrics]:grid-cols-3
  max-[900px]:[&_.site-header]:h-[70px] max-[900px]:[&_.site-header]:px-[18px]
  max-[900px]:[&_.mobile-menu-toggle]:z-10 max-[900px]:[&_.mobile-menu-toggle]:grid max-[900px]:[&_.mobile-menu-toggle]:size-11 max-[900px]:[&_.mobile-menu-toggle]:content-center max-[900px]:[&_.mobile-menu-toggle]:gap-1.5 max-[900px]:[&_.mobile-menu-toggle]:rounded-lg max-[900px]:[&_.mobile-menu-toggle]:border max-[900px]:[&_.mobile-menu-toggle]:border-white/20 max-[900px]:[&_.mobile-menu-toggle]:bg-white/5 max-[900px]:[&_.mobile-menu-toggle_span]:block max-[900px]:[&_.mobile-menu-toggle_span]:h-0.5 max-[900px]:[&_.mobile-menu-toggle_span]:w-full max-[900px]:[&_.mobile-menu-toggle_span]:bg-white
  max-[900px]:[&_.site-header_nav]:invisible max-[900px]:[&_.site-header_nav]:absolute max-[900px]:[&_.site-header_nav]:inset-x-0 max-[900px]:[&_.site-header_nav]:top-[calc(100%+9px)] max-[900px]:[&_.site-header_nav]:h-auto max-[900px]:[&_.site-header_nav]:max-h-0 max-[900px]:[&_.site-header_nav]:overflow-hidden max-[900px]:[&_.site-header_nav]:rounded-xl max-[900px]:[&_.site-header_nav]:border max-[900px]:[&_.site-header_nav]:border-white/20 max-[900px]:[&_.site-header_nav]:bg-brand-dark max-[900px]:[&_.site-header_nav]:p-0 max-[900px]:[&_.site-header_nav]:opacity-0
  max-[900px]:[&_.site-header_nav.open]:visible max-[900px]:[&_.site-header_nav.open]:grid max-[900px]:[&_.site-header_nav.open]:max-h-[480px] max-[900px]:[&_.site-header_nav.open]:gap-1 max-[900px]:[&_.site-header_nav.open]:p-2 max-[900px]:[&_.site-header_nav.open]:opacity-100
  max-[900px]:[&_.site-header_nav_a]:w-full max-[900px]:[&_.site-header_nav_a]:px-3 max-[900px]:[&_.site-header_nav_a]:py-2
  max-[900px]:[&_.hero-content]:w-[78%] max-[900px]:[&_.hero-content]:pl-10
  max-[900px]:[&_.location-section]:w-[min(calc(100%-40px),720px)] max-[900px]:[&_.location-section]:grid-cols-1
  max-[900px]:[&_.auth-wrap]:grid-cols-1 max-[900px]:[&_.auth-side]:min-h-[300px] max-[900px]:[&_.auth-side]:h-[300px]
  max-[900px]:[&_.admin-shell]:grid-cols-1 max-[900px]:[&_.admin-nav]:sticky max-[900px]:[&_.admin-nav]:top-[70px] max-[900px]:[&_.admin-nav]:z-20 max-[900px]:[&_.admin-nav]:flex-row max-[900px]:[&_.admin-nav]:overflow-x-auto max-[900px]:[&_.admin-nav]:p-3 max-[900px]:[&_.admin-nav_h2]:hidden max-[900px]:[&_.admin-nav_.eyebrow]:hidden max-[900px]:[&_.admin-nav-label]:hidden
  max-[900px]:[&_.operations-summary]:grid-cols-2 max-[900px]:[&_.operations-heading]:block max-[900px]:[&_.operations-actions]:mt-5 max-[900px]:[&_.operations-actions]:justify-start
  max-[900px]:[&_.operations-booking]:grid-cols-[72px_minmax(0,1fr)] max-[900px]:[&_.operations-booking-actions]:col-start-2 max-[900px]:[&_.operations-booking-actions]:justify-start
  max-[900px]:[&_.clients-header]:grid max-[900px]:[&_.clients-header]:items-start max-[900px]:[&_.clients-header_.btn]:w-full
  max-[900px]:[&_.story-workbench]:grid-cols-1
  max-[900px]:[&_.story-controls]:static

  max-[768px]:[&_.footer-container]:grid-cols-1 max-[768px]:[&_.footer-container]:gap-8 max-[768px]:[&_.footer-bottom]:grid
  max-[768px]:[&_.page-head]:px-[18px] max-[768px]:[&_.page-head]:pt-10
  max-[769px]:[&_.turn-grid-layout]:w-[calc(100%-28px)] max-[769px]:[&_.turn-grid-layout]:grid-cols-1
  max-[769px]:[&_.turn-filters]:border-r-0 max-[769px]:[&_.turn-filters]:border-b max-[769px]:[&_.turn-results]:p-5
  max-[768px]:[&_.cards-list]:px-4 max-[768px]:[&_.booking-card]:grid-cols-[58px_1fr] max-[768px]:[&_.booking-card>strong]:col-start-2 max-[768px]:[&_.booking-card>.btn]:col-start-2
  max-[768px]:[&_.booking-modal]:w-full max-[768px]:[&_.booking-modal]:p-5
  max-[768px]:[&_.form-grid]:grid-cols-1 max-[768px]:[&_.form-grid.three]:grid-cols-1 max-[768px]:[&_.form-grid_.wide]:col-auto
  max-[768px]:[&_.admin-form-page]:px-4 max-[768px]:[&_.admin-form-page]:py-8 max-[768px]:[&_.manual-booking-form]:p-5
  max-[768px]:[&_.manual-booking-form_.form-grid.three]:grid-cols-2 max-[768px]:[&_.manual-booking-form_.schedule-field]:col-span-1 max-[768px]:[&_.manual-booking-form_.financial-field]:col-span-1 max-[768px]:[&_.manual-booking-form_.notes-field]:col-span-2
  max-[768px]:[&_.operations-agenda-heading]:items-start max-[768px]:[&_.operations-agenda-heading]:flex-col
  max-[768px]:[&_.dashboard-heading]:items-start max-[768px]:[&_.dashboard-heading]:flex-col max-[768px]:[&_.dashboard-metrics]:grid-cols-2 max-[768px]:[&_.dashboard-grid]:grid-cols-1
  max-[768px]:[&_.security-grid]:grid-cols-1 max-[768px]:[&_.audit-panel]:col-auto max-[768px]:[&_.safety-note]:col-auto
  max-[768px]:[&_.client-row]:grid-cols-[54px_1fr] max-[768px]:[&_.client-actions]:col-span-full max-[768px]:[&_.client-actions]:justify-start

  max-[600px]:[&_.hero-content]:w-full max-[600px]:[&_.hero-content]:justify-end max-[600px]:[&_.hero-content]:px-6 max-[600px]:[&_.hero-content]:pt-24 max-[600px]:[&_.hero-content]:pb-8
  max-[600px]:[&_.hero-title]:text-[clamp(3.3rem,15vw,4.8rem)] max-[600px]:[&_.hero-actions]:grid max-[600px]:[&_.hero-actions]:grid-cols-2
  max-[600px]:[&_.hero-details]:grid-cols-1 max-[600px]:[&_.hero-details>div]:grid-cols-[105px_1fr] max-[600px]:[&_.hero-details>div]:border-r-0 max-[600px]:[&_.hero-details>div]:border-b
  max-[600px]:[&_.booking-summary]:grid-cols-1 max-[600px]:[&_.cancel-summary]:grid-cols-1 max-[600px]:[&_.cancel-actions]:grid-cols-1
  max-[600px]:[&_.operations-date-picker]:w-full max-[600px]:[&_.operations-booking]:grid-cols-[58px_minmax(0,1fr)] max-[600px]:[&_.operations-booking]:gap-3 max-[600px]:[&_.operations-booking]:px-3 max-[600px]:[&_.operations-booking]:py-4 max-[600px]:[&_.operations-booking-actions]:col-span-full max-[600px]:[&_.operations-booking-actions]:grid max-[600px]:[&_.operations-booking-actions]:grid-cols-2
  max-[600px]:[&_.advanced-menu_nav]:grid max-[600px]:[&_.advanced-menu_nav]:grid-cols-2
  max-[600px]:[&_.clients-toolbar]:p-4 max-[600px]:[&_.client-tabs_button]:flex-[1_1_132px] max-[600px]:[&_.client-row]:grid-cols-[46px_minmax(0,1fr)] max-[600px]:[&_.client-avatar]:size-[46px] max-[600px]:[&_.client-actions]:col-span-full max-[600px]:[&_.client-actions]:max-w-none max-[600px]:[&_.client-actions]:justify-start
  max-[600px]:[&_.booking-entry]:px-4 max-[600px]:[&_.booking-entry]:py-9 max-[600px]:[&_.booking-entry-card]:rounded-2xl max-[600px]:[&_.booking-entry-card]:p-5 max-[600px]:[&_.booking-entry-actions]:grid-cols-1
  max-[600px]:[&_.stories-header]:grid max-[600px]:[&_.stories-header-actions]:justify-start max-[600px]:[&_.stories-header_h1]:text-[2.45rem]
  max-[600px]:[&_.template-picker]:grid-cols-1 max-[600px]:[&_.control-grid]:grid-cols-1 max-[600px]:[&_.asset-gallery]:grid-cols-1 max-[600px]:[&_.preview-toolbar]:grid max-[600px]:[&_.story-preview-panel]:p-3.5 max-[600px]:[&_.phone-frame]:p-[7px]

  max-[520px]:[&_.recovery]:grid-cols-1 max-[520px]:[&_.recovery-copy]:px-5 max-[520px]:[&_.recovery-copy]:py-11 max-[520px]:[&_.recovery-copy_h1]:text-[3.7rem]
  max-[520px]:[&_.auth-form-side]:p-4 max-[520px]:[&_.auth-card]:p-5 max-[520px]:[&_.two]:grid-cols-1
  max-[520px]:[&_.period-panel]:items-start max-[520px]:[&_.period-panel]:flex-col max-[520px]:[&_.dashboard-metrics]:grid-cols-1
  max-[520px]:[&_.clients-header]:items-start max-[520px]:[&_.clients-header]:flex-col
  max-[520px]:[&_.manual-booking-form_.form-grid.three]:grid-cols-1 max-[520px]:[&_.manual-booking-form_.schedule-field]:col-span-1 max-[520px]:[&_.manual-booking-form_.financial-field]:col-span-1 max-[520px]:[&_.manual-booking-form_.notes-field]:col-span-1
  max-[520px]:[&_.booking-mode-switch]:grid-cols-1 max-[520px]:[&_.booking-mode-switch_button]:border-r-0 max-[520px]:[&_.booking-mode-switch_button]:border-b max-[520px]:[&_.booking-mode-switch_button:last-child]:border-b-0
  max-[520px]:[&_.manual-total]:grid max-[520px]:[&_.manual-total]:gap-2 max-[520px]:[&_.manual-total_strong]:text-[1.75rem]
  max-[520px]:[&_.operations-booking]:grid-cols-1 max-[520px]:[&_.operations-booking>time]:grid-cols-[auto_auto] max-[520px]:[&_.operations-booking>time]:items-baseline max-[520px]:[&_.operations-booking>time]:justify-start max-[520px]:[&_.operations-booking>time]:gap-2 max-[520px]:[&_.operations-booking-actions]:col-auto
  max-[520px]:[&_.client-row]:grid-cols-1 max-[520px]:[&_.client-avatar]:hidden max-[520px]:[&_.client-actions]:grid max-[520px]:[&_.client-actions]:grid-cols-2 max-[520px]:[&_.client-actions_.small-action]:w-full max-[520px]:[&_.client-form-actions]:grid max-[520px]:[&_.client-form-actions_.btn]:w-full
  max-[520px]:[&_.confirm-dialog]:rounded-[18px] max-[520px]:[&_.confirm-dialog]:px-5 max-[520px]:[&_.confirm-dialog]:py-[26px] max-[520px]:[&_.confirm-dialog_h2]:text-[2rem] max-[520px]:[&_.confirm-dialog-actions]:grid-cols-1
  max-[520px]:[&_.expected]:grid-cols-1 max-[520px]:[&_.modal-actions]:grid-cols-1
  max-[420px]:[&_.operations-summary]:grid-cols-1 max-[420px]:[&_.operations-summary_article]:min-h-[96px] max-[420px]:[&_.operations-summary_article]:p-4
  max-[420px]:[&_.operations-booking-actions]:grid-cols-1 max-[420px]:[&_.advanced-menu_nav]:grid-cols-1
  max-[420px]:[&_.duration-options]:gap-1.5 max-[420px]:[&_.duration-options_button]:min-h-[78px] max-[420px]:[&_.duration-options_button]:px-1.5 max-[420px]:[&_.duration-label]:text-[.78rem] max-[420px]:[&_.duration-price]:text-[.62rem]
`;
