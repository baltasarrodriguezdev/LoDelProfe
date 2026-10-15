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
            <li><a href="/politica-de-privacidad#responsable">Responsable y alcance</a></li>
            <li><a href="/politica-de-privacidad#datos">Datos que tratamos</a></li>
            <li><a href="/politica-de-privacidad#finalidades">Para qué los usamos</a></li>
            <li><a href="/politica-de-privacidad#proveedores">Proveedores y terceros</a></li>
            <li><a href="/politica-de-privacidad#conservacion">Conservación y seguridad</a></li>
            <li><a href="/politica-de-privacidad#derechos">Tus derechos</a></li>
          </ol>
        </nav>

        <div class="privacy-content">
          <p class="privacy-intro">
            Esta política se aplica al sitio y a la aplicación web de <strong>Lo del Profe</strong>.
            Explica qué información se utiliza y con qué finalidad. No abarca las prácticas propias
            de servicios externos, como WhatsApp o Google, que tienen sus propias políticas.
          </p>

          <section id="responsable">
            <span class="section-number" aria-hidden="true">01</span>
            <h2>Responsable y alcance</h2>
            <p>
              El responsable del tratamiento es <strong>Adrián Rodríguez Teruel</strong>, titular de
              la actividad identificada comercialmente como <strong>Lo del Profe</strong>, en Villa
              Concepción del Tío, Córdoba, Argentina.
            </p>
            <p>
              Para consultas o solicitudes relacionadas con datos personales podés escribir a
              <a href="mailto:lodelprofe.padel@gmail.com">lodelprofe.padel&#64;gmail.com</a>.
            </p>
          </section>

          <section id="datos">
            <span class="section-number" aria-hidden="true">02</span>
            <h2>Datos que tratamos</h2>

            <h3>Cuentas y seguridad</h3>
            <p>
              Al registrarte se solicitan nombre, apellido, número de teléfono y contraseña. La
              contraseña se conserva transformada mediante un hash seguro, no como texto legible.
              También se registran el estado de la cuenta, la verificación del teléfono, fechas de
              alta y actualización y, cuando corresponde, solicitudes de recuperación de acceso.
            </p>

            <h3>Reservas</h3>
            <p>
              Para administrar turnos se tratan el nombre y teléfono de la persona que reserva,
              cancha, fecha, horario, duración, cantidad de jugadores, precio, estado de la reserva,
              origen del pedido, observaciones, cancelaciones y datos operativos de pago como estado,
              importe y medio informado. La aplicación no solicita datos de tarjeta ni credenciales
              bancarias.
            </p>

            <h3>Liga Suma 12</h3>
            <p>
              Para organizar y comunicar la competencia se utilizan nombres de jugadores y parejas,
              zonas, fixture, horarios, resultados, posiciones y cruces. Los nombres deportivos,
              resultados y posiciones de una temporada publicada son visibles en la página pública de
              la liga y pueden integrarse en piezas de comunicación de la competencia.
            </p>

            <h3>WhatsApp</h3>
            <p>
              La aplicación puede abrir WhatsApp con un mensaje ya preparado para verificar una
              cuenta, confirmar una solicitud, gestionar una reserva o brindar asistencia. Al iniciar
              esa conversación, Lo del Profe recibe el número, el contenido del mensaje y la información
              de perfil que la persona tenga disponible en WhatsApp. El envío se realiza por decisión
              del usuario desde WhatsApp; la aplicación no lee otras conversaciones ni la agenda del
              dispositivo.
            </p>

            <h3>Fotografías e imágenes</h3>
            <p>
              El flujo público actual no permite que clientes suban fotografías. El sitio muestra
              imágenes institucionales de la cancha y las herramientas administrativas permiten
              preparar piezas para redes sociales; las imágenes cargadas en esa herramienta se guardan
              localmente en el navegador del administrador. Si una publicación incorporara la imagen
              identificable de una persona, deberá contar con la autorización o fundamento aplicable.
              Podés solicitar su revisión o retiro por el correo indicado en esta política.
            </p>

            <h3>Datos técnicos y del dispositivo</h3>
            <p>
              Se utilizan cookies estrictamente necesarias para mantener la sesión y proteger
              solicitudes, además de almacenamiento local o temporal del navegador para recordar el
              usuario conectado, continuar una reserva y gestionar actualizaciones de la aplicación.
              Los registros técnicos y de seguridad pueden incluir dirección IP, fecha, hora y agente
              de usuario. Las notificaciones web, cuando están habilitadas para personal administrador,
              requieren guardar la suscripción del navegador.
            </p>

            <h3>Medición y mapas</h3>
            <p>
              El sitio utiliza Google Analytics para obtener métricas de navegación y un mapa de Google
              Maps para mostrar la ubicación de la cancha. Estos servicios pueden recibir identificadores
              en línea, información del dispositivo, dirección IP y datos de interacción de acuerdo con
              su propia configuración y política de privacidad.
            </p>
          </section>

          <section id="finalidades">
            <span class="section-number" aria-hidden="true">03</span>
            <h2>Para qué usamos los datos</h2>
            <ul>
              <li>Crear, verificar y proteger cuentas de usuario.</li>
              <li>Consultar disponibilidad, registrar, confirmar, modificar o cancelar reservas.</li>
              <li>Contactar a clientes por cuestiones directamente vinculadas con su cuenta o turno.</li>
              <li>Organizar y publicar la información deportiva de Liga Suma 12.</li>
              <li>Atender consultas, solicitudes de recuperación y reclamos.</li>
              <li>Mantener la seguridad, prevenir abusos y registrar acciones administrativas.</li>
              <li>Conocer el funcionamiento general del sitio y facilitar cómo llegar a la cancha.</li>
            </ul>
            <p>
              El tratamiento se realiza, según corresponda, para gestionar la relación y las solicitudes
              del usuario, cumplir obligaciones aplicables, proteger el funcionamiento del servicio o
              sobre la base del consentimiento. Lo del Profe no vende ni alquila datos personales.
            </p>
          </section>

          <section id="proveedores">
            <span class="section-number" aria-hidden="true">04</span>
            <h2>Proveedores tecnológicos y terceros</h2>
            <p>
              Para operar el servicio pueden intervenir proveedores de alojamiento web, base de datos,
              comunicaciones en tiempo real, seguridad y notificaciones. Sólo deben recibir la
              información necesaria para prestar su servicio y tratarla siguiendo las instrucciones del
              responsable y las condiciones contractuales aplicables.
            </p>
            <p>Además, al usar determinadas funciones intervienen:</p>
            <ul>
              <li>
                <strong>Meta / WhatsApp</strong>, cuando una persona decide iniciar o continuar una
                conversación por ese canal. Consultá la
                <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">política de privacidad de WhatsApp</a>.
              </li>
              <li>
                <strong>Google</strong>, por Google Analytics y el mapa embebido. Consultá la
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">política de privacidad de Google</a>.
              </li>
              <li>
                <strong>Proveedores del navegador o sistema operativo</strong>, si el personal
                administrador activa notificaciones web.
              </li>
            </ul>
            <p>
              Algunos proveedores pueden procesar información fuera de Argentina. El país de destino y
              las condiciones concretas dependen del proveedor y de la infraestructura configurada en
              cada momento.
            </p>
          </section>

          <section id="conservacion">
            <span class="section-number" aria-hidden="true">05</span>
            <h2>Conservación y seguridad</h2>
            <p>
              La aplicación no tiene configurado actualmente un plazo automático general de eliminación.
              Los datos permanecen asociados a las cuentas, reservas, registros operativos o temporadas
              mientras esos registros existan y puedan ser necesarios para la gestión, la seguridad, la
              resolución de reclamos o el cumplimiento de obligaciones aplicables. Una solicitud de
              supresión será evaluada considerando esas necesidades y los deberes legales de conservación.
            </p>
            <p>
              Se aplican medidas técnicas de acceso y seguridad acordes con el servicio, entre ellas
              contraseñas almacenadas mediante hash, sesiones protegidas, controles por roles y registros
              de determinadas acciones administrativas. Ningún sistema ofrece seguridad absoluta; ante
              un incidente se adoptarán las medidas razonables que correspondan.
            </p>
          </section>

          <section id="derechos">
            <span class="section-number" aria-hidden="true">06</span>
            <h2>Tus derechos y cómo eliminar tus datos</h2>
            <p>
              Podés solicitar información y acceso a tus datos, o pedir su actualización, rectificación,
              confidencialidad o supresión cuando corresponda conforme a la Ley 25.326. Para hacerlo,
              escribí a <a href="mailto:lodelprofe.padel@gmail.com?subject=Solicitud%20sobre%20mis%20datos%20personales">lodelprofe.padel&#64;gmail.com</a>,
              indicando tu nombre, teléfono asociado y el alcance de la solicitud. Se podrá pedir una
              verificación razonable de identidad antes de responder.
            </p>
            <p>
              El derecho de acceso puede ejercerse gratuitamente con una frecuencia no inferior a seis
              meses, salvo interés legítimo. La Ley 25.326 prevé diez días corridos para responder pedidos
              de acceso y cinco días hábiles para rectificación, actualización o supresión.
            </p>
            <p>
              La Agencia de Acceso a la Información Pública (AAIP) es el órgano de control de la Ley
              25.326 y recibe denuncias y reclamos. Podés consultar la
              <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noopener noreferrer">información oficial sobre tus derechos</a>.
            </p>
          </section>

          <section id="cambios">
            <span class="section-number" aria-hidden="true">07</span>
            <h2>Cambios a esta política</h2>
            <p>
              Esta política podrá actualizarse si cambian las funciones del servicio, los proveedores o
              las obligaciones aplicables. La fecha de la versión vigente se muestra al comienzo de la
              página.
            </p>
          </section>

          <div class="privacy-contact">
            <div>
              <span>CONTACTO DE PRIVACIDAD</span>
              <strong>¿Querés consultar o eliminar tus datos?</strong>
            </div>
            <a href="mailto:lodelprofe.padel@gmail.com?subject=Solicitud%20sobre%20mis%20datos%20personales">Escribir por correo</a>
          </div>

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
