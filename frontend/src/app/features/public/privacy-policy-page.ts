import { ChangeDetectionStrategy, Component, inject, OnDestroy } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="privacy-page">
      <header class="privacy-hero">
        <div class="privacy-hero-inner">
          <div class="privacy-heading">
            <span class="eyebrow">INFORMACIÓN Y PRIVACIDAD</span>
            <h1 aria-label="Política de Privacidad">Política de<br>Privacidad</h1>
            <p>
              Cómo tratamos los datos personales vinculados con las reservas, las cuentas,
              Liga Suma 12 y los canales de contacto de Lo del Profe.
            </p>
          </div>
          <dl class="privacy-summary" aria-label="Datos principales de esta política">
            <div>
              <dt>Responsable</dt>
              <dd>Adrián Rodríguez Teruel</dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>Villa Concepción del Tío, Córdoba, Argentina</dd>
            </div>
            <div>
              <dt>Última actualización</dt>
              <dd><time datetime="2026-10-15">15 de octubre de 2026</time></dd>
            </div>
          </dl>
        </div>
      </header>

      <div class="privacy-layout">
        <nav class="privacy-index" aria-label="Contenido de la política">
          <span>EN ESTA PÁGINA</span>
          <ol>
            <li><a href="/politica-de-privacidad#datos">Datos recopilados</a></li>
            <li><a href="/politica-de-privacidad#finalidad">Finalidad</a></li>
            <li><a href="/politica-de-privacidad#whatsapp-fotografias">WhatsApp y fotografías</a></li>
            <li><a href="/politica-de-privacidad#proteccion-derechos">Protección y derechos</a></li>
            <li><a href="/politica-de-privacidad#contacto">Contacto</a></li>
          </ol>
        </nav>

        <div class="privacy-content">
          <p class="privacy-intro">
            Esta política explica de forma simple cómo <strong>Lo del Profe</strong> usa la información
            necesaria para gestionar cuentas, reservas, Liga Suma 12 y consultas de sus clientes. El
            responsable es <strong>Adrián Rodríguez Teruel</strong>, en Villa Concepción del Tío,
            Córdoba, Argentina.
            </p>

          <section id="datos">
            <span class="section-number" aria-hidden="true">01</span>
            <h2>Datos recopilados</h2>

            <h3>Cuenta y reservas</h3>
            <p>
              Al registrarte pedimos nombre, apellido, teléfono y contraseña. También guardamos la
              verificación y el estado de la cuenta. Para gestionar un turno usamos el nombre y el
              teléfono de quien reserva, fecha, horario, duración, cantidad de jugadores, precio,
              estado, observaciones y cancelaciones. Cuando corresponde, se registra el estado, importe
              y medio de pago informado. La aplicación no pide datos de tarjeta ni claves bancarias.
            </p>

            <h3>Liga Suma 12</h3>
            <p>
              Para organizar la liga se usan nombres de jugadores y parejas, zonas, partidos, horarios,
              resultados, posiciones y cruces. Los nombres, resultados y posiciones de una temporada
              publicada son visibles en la página pública de Liga Suma 12 y pueden aparecer en piezas
              informativas de la competencia.
            </p>

            <h3>Uso del sitio</h3>
            <p>
              Usamos cookies necesarias para mantener la sesión y proteger la cuenta, y almacenamiento
              del navegador para recordar al usuario conectado o continuar una reserva. Los registros
              técnicos pueden incluir dirección IP, fecha, hora y datos del navegador. Además, Google
              Analytics mide el uso general del sitio y Google Maps muestra la ubicación de la cancha.
            </p>
          </section>

          <section id="finalidad">
            <span class="section-number" aria-hidden="true">02</span>
            <h2>Para qué usamos los datos</h2>
            <ul>
              <li>Crear, verificar y proteger cuentas.</li>
              <li>Consultar horarios y gestionar reservas o cancelaciones.</li>
              <li>Contactar a clientes por temas relacionados con su cuenta o turno.</li>
              <li>Organizar y comunicar Liga Suma 12.</li>
              <li>Responder consultas y solicitudes de recuperación de acceso.</li>
              <li>Mantener la seguridad y conocer el funcionamiento general del sitio.</li>
            </ul>
            <p>
              Lo del Profe no vende ni alquila los datos personales de sus clientes.
            </p>
          </section>

          <section id="whatsapp-fotografias">
            <span class="section-number" aria-hidden="true">03</span>
            <h2>WhatsApp y fotografías</h2>

            <h3>WhatsApp</h3>
            <p>
              La aplicación puede abrir WhatsApp con un mensaje preparado para verificar una cuenta,
              gestionar una reserva o responder una consulta. Si decidís enviarlo, Lo del Profe recibe
              tu número, el mensaje y la información de perfil que tengas visible en WhatsApp. La
              aplicación no accede a tu agenda ni a otras conversaciones.
            </p>
            <p>
              WhatsApp es un servicio de Meta y trata la información de acuerdo con su
              <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">propia política de privacidad</a>.
            </p>
            <p>
              Si en el futuro habilitamos mediante WhatsApp Business la automatización de mensajes o
              el procesamiento de fotografías, informaremos cómo se usarán esos datos antes de utilizar
              esas funciones.
            </p>

            <h3>Fotografías</h3>
            <p>
              El sitio público no permite que los clientes suban fotos. Muestra imágenes institucionales
              de la cancha y las herramientas administrativas permiten preparar imágenes para redes
              sociales, que se guardan localmente en el navegador del administrador. Las imágenes en las
              que una persona pueda ser identificada requieren la autorización correspondiente antes de
              publicarse, especialmente cuando participan menores de edad. Podés pedir que las revisemos
              o retiremos escribiéndonos por correo.
            </p>
          </section>

          <section id="proteccion-derechos">
            <span class="section-number" aria-hidden="true">04</span>
            <h2>Protección de datos y tus derechos</h2>

            <h3>Cómo cuidamos la información</h3>
            <p>
              Las contraseñas se guardan mediante un hash seguro, no como texto legible. La aplicación
              usa sesiones protegidas, controles de acceso por roles y registros de determinadas acciones
              administrativas. Para operar el servicio también se usan proveedores de alojamiento, base
              de datos, notificaciones, Google y WhatsApp, que pueden recibir la información necesaria
              para prestar sus funciones.
            </p>
            <p>
              El sistema no tiene hoy un plazo automático general para borrar datos. La información queda
              asociada a las cuentas, reservas y registros mientras sea necesaria para la gestión, la
              seguridad, la atención de reclamos o las obligaciones aplicables.
            </p>

            <h3>Tus derechos</h3>
            <p>
              Podés pedirnos que te informemos qué datos tuyos tenemos, que los corrijamos, actualicemos
              o eliminemos cuando corresponda. Para proteger tu información podemos pedirte que confirmes
              tu identidad. Escribinos indicando tu nombre, el teléfono asociado y qué necesitás.
            </p>
          </section>

          <section id="contacto">
            <span class="section-number" aria-hidden="true">05</span>
            <h2>Contacto</h2>
            <p>
              <strong>Responsable:</strong> Adrián Rodríguez Teruel<br>
              <strong>Nombre comercial:</strong> Lo del Profe<br>
              <strong>Ubicación:</strong> Villa Concepción del Tío, Córdoba, Argentina<br>
              <strong>Correo:</strong> <a href="mailto:lodelprofe.padel@gmail.com">lodelprofe.padel&#64;gmail.com</a>
            </p>
            <p>Última actualización: <time datetime="2026-10-15">15 de octubre de 2026</time>.</p>

            <div class="privacy-contact">
              <div>
                <span>CONTACTO DE PRIVACIDAD</span>
                <strong>¿Querés consultar o eliminar tus datos?</strong>
              </div>
              <a href="mailto:lodelprofe.padel@gmail.com?subject=Solicitud%20sobre%20mis%20datos%20personales">Escribir por correo</a>
            </div>
          </section>

          <a class="privacy-back" routerLink="/">← Volver al inicio</a>
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host {
      display: block;
    }

    .privacy-page {
      background:
        linear-gradient(90deg, transparent 0, transparent calc(50% - 1px), rgba(90, 107, 60, .055) 50%, transparent calc(50% + 1px)),
        var(--color-brand-cream);
    }

    .privacy-hero {
      border-bottom: 1px solid var(--color-brand-border);
      background: linear-gradient(135deg, #e4e8db 0%, var(--color-brand-cream) 58%, #f8f6f0 100%);
    }

    .privacy-hero-inner {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr);
      gap: clamp(40px, 8vw, 110px);
      width: min(calc(100% - 48px), 1200px);
      margin: 0 auto;
      padding: clamp(64px, 9vw, 112px) 0 clamp(52px, 7vw, 88px);
    }

    .privacy-heading h1 {
      max-width: 760px;
      margin: 18px 0 24px;
      color: var(--color-brand-dark);
      font-size: clamp(4rem, 8vw, 7.25rem);
      line-height: .86;
    }

    .privacy-heading p {
      max-width: 650px;
      margin: 0;
      color: var(--color-brand-text);
      font-size: clamp(1rem, 1.5vw, 1.18rem);
    }

    .privacy-summary {
      align-self: end;
      margin: 0;
      border-top: 3px solid var(--color-brand-green);
    }

    .privacy-summary div {
      display: grid;
      gap: 4px;
      border-bottom: 1px solid var(--color-brand-border);
      padding: 16px 0;
    }

    .privacy-summary dt,
    .privacy-index > span,
    .privacy-contact span {
      color: var(--color-brand-green);
      font-size: .66rem;
      font-weight: 800;
      letter-spacing: .15em;
      text-transform: uppercase;
    }

    .privacy-summary dd {
      margin: 0;
      color: var(--color-brand-dark);
      font-size: .88rem;
      font-weight: 700;
      line-height: 1.45;
    }

    .privacy-layout {
      display: grid;
      grid-template-columns: 230px minmax(0, 760px);
      justify-content: center;
      gap: clamp(50px, 8vw, 110px);
      width: min(calc(100% - 48px), 1200px);
      margin: 0 auto;
      padding: clamp(56px, 8vw, 96px) 0 104px;
    }

    .privacy-index {
      position: sticky;
      top: calc(var(--site-header-height) + 28px);
      align-self: start;
      border-top: 1px solid var(--color-brand-border);
      padding-top: 18px;
    }

    .privacy-index ol {
      display: grid;
      gap: 12px;
      margin: 18px 0 0;
      padding: 0;
      list-style: none;
      counter-reset: policy-index;
    }

    .privacy-index li {
      counter-increment: policy-index;
    }

    .privacy-index a {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 8px;
      color: var(--color-brand-muted);
      font-size: .78rem;
      line-height: 1.4;
    }

    .privacy-index a::before {
      content: counter(policy-index, decimal-leading-zero);
      color: var(--color-brand-gold);
      font-size: .66rem;
      font-weight: 800;
    }

    .privacy-index a:hover {
      color: var(--color-brand-dark);
    }

    .privacy-content {
      min-width: 0;
    }

    .privacy-intro {
      margin: 0 0 64px;
      border-left: 5px solid var(--color-brand-gold);
      padding: 5px 0 5px 24px;
      color: var(--color-brand-dark);
      font-size: clamp(1.1rem, 2vw, 1.35rem);
      line-height: 1.65;
    }

    .privacy-content section {
      position: relative;
      scroll-margin-top: calc(var(--site-header-height) + 28px);
      border-top: 1px solid var(--color-brand-border);
      padding: 56px 0 12px;
    }

    .privacy-content section + section {
      margin-top: 28px;
    }

    .section-number {
      position: absolute;
      top: 54px;
      left: -58px;
      color: var(--color-brand-gold);
      font-family: var(--font-display);
      font-size: 1.15rem;
    }

    .privacy-content h2 {
      margin: 0 0 28px;
      color: var(--color-brand-dark);
      font-size: clamp(2.25rem, 5vw, 3.65rem);
      line-height: .98;
      text-transform: uppercase;
    }

    .privacy-content h3 {
      margin: 34px 0 10px;
      color: var(--color-brand-dark);
      font-size: 1.08rem;
    }

    .privacy-content p,
    .privacy-content li {
      color: #52514d;
      font-size: .97rem;
      line-height: 1.8;
    }

    .privacy-content p {
      margin: 0 0 18px;
    }

    .privacy-content ul {
      display: grid;
      gap: 10px;
      margin: 0 0 24px;
      padding-left: 22px;
    }

    .privacy-content li::marker {
      color: var(--color-brand-gold);
    }

    .privacy-content strong {
      color: var(--color-brand-dark);
    }

    .privacy-content a:not(.privacy-back) {
      color: var(--color-brand-green-dark);
      font-weight: 700;
      text-decoration: underline;
      text-decoration-color: color-mix(in srgb, var(--color-brand-green) 45%, transparent);
      text-underline-offset: 4px;
    }

    .privacy-contact {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      margin-top: 72px;
      border-radius: 14px;
      padding: 26px 28px;
      background: var(--color-brand-dark);
      color: var(--color-brand-paper);
      box-shadow: 8px 8px 0 color-mix(in srgb, var(--color-brand-gold) 32%, transparent);
    }

    .privacy-contact div {
      display: grid;
      gap: 5px;
    }

    .privacy-contact span {
      color: #bcc88c;
    }

    .privacy-contact strong {
      color: var(--color-brand-paper);
      font-size: 1.05rem;
    }

    .privacy-contact > a {
      flex: 0 0 auto;
      border: 1px solid rgba(255, 255, 255, .4);
      border-radius: 8px;
      padding: 11px 16px;
      color: var(--color-brand-paper) !important;
      text-decoration: none !important;
    }

    .privacy-contact > a:hover {
      border-color: var(--color-brand-gold);
      background: rgba(255, 255, 255, .07);
    }

    .privacy-back {
      display: inline-flex;
      margin-top: 44px;
      color: var(--color-brand-green);
      font-size: .86rem;
      font-weight: 800;
    }

    @media (max-width: 900px) {
      .privacy-hero-inner {
        grid-template-columns: 1fr;
        gap: 36px;
      }

      .privacy-summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .privacy-summary div {
        border-right: 1px solid var(--color-brand-border);
        padding-right: 16px;
        padding-left: 16px;
      }

      .privacy-summary div:first-child {
        padding-left: 0;
      }

      .privacy-summary div:last-child {
        border-right: 0;
      }

      .privacy-layout {
        grid-template-columns: 1fr;
      }

      .privacy-index {
        position: static;
      }

      .privacy-index ol {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .section-number {
        position: static;
        display: block;
        margin-bottom: 8px;
      }
    }

    @media (max-width: 600px) {
      .privacy-hero-inner,
      .privacy-layout {
        width: min(calc(100% - 40px), 1200px);
      }

      .privacy-hero-inner {
        padding-top: 48px;
      }

      .privacy-heading h1 {
        font-size: clamp(3.5rem, 18vw, 5.2rem);
      }

      .privacy-summary {
        grid-template-columns: 1fr;
      }

      .privacy-summary div,
      .privacy-summary div:first-child,
      .privacy-summary div:last-child {
        border-right: 0;
        padding-right: 0;
        padding-left: 0;
      }

      .privacy-index ol {
        grid-template-columns: 1fr;
      }

      .privacy-intro {
        margin-bottom: 44px;
        padding-left: 17px;
      }

      .privacy-content section {
        padding-top: 44px;
      }

      .privacy-content section + section {
        margin-top: 18px;
      }

      .privacy-contact {
        align-items: stretch;
        flex-direction: column;
        padding: 23px;
      }

      .privacy-contact > a {
        text-align: center;
      }
    }
  `]
})
export class PrivacyPolicyPage implements OnDestroy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly previousTitle = this.title.getTitle();
  private readonly previousDescription = this.meta.getTag('name="description"')?.getAttribute('content') ?? null;

  constructor() {
    this.title.setTitle('Política de Privacidad · Lo del Profe');
    this.meta.updateTag({
      name: 'description',
      content: 'Política de Privacidad de Lo del Profe: reservas, usuarios, Liga Suma 12, WhatsApp, fotografías y proveedores tecnológicos.'
    });
  }

  ngOnDestroy() {
    this.title.setTitle(this.previousTitle);
    if (this.previousDescription === null) this.meta.removeTag('name="description"');
    else this.meta.updateTag({ name: 'description', content: this.previousDescription });
  }
}
