/* ── Páginas legales ──────────────────────────────────────────────────
   Yacht Today cobra dinero y guarda documentación personal (DNI, licencias de navegación,
   pólizas de seguro). Operar así sin política de privacidad ni condiciones no es un
   descuido de diseño: en España y en la UE es ilegal. Además, la propia web ya le decía al
   usuario "tratamos tus datos conforme al RGPD" sin que hubiera ningún sitio donde
   explicarlo.

   NO SOY ABOGADO. Esto cubre lo básico y está escrito para que se entienda, pero antes de
   crecer conviene que lo revise uno de verdad.

   IMPORTANTE: los datos de identificación (nombre fiscal, NIF y domicilio) los tiene que
   rellenar Eric — inventárselos sería falsear un documento legal. Mientras estén sin
   rellenar, las páginas lo dicen abiertamente en vez de fingir que están completas. */

import React from "react";

/* Rellena esto con tus datos reales. Mientras `NIF` o `DOMICILIO` sigan vacíos, el aviso
   legal avisa de que está incompleto: es preferible a publicar un dato inventado. */
export const TITULAR = {
  nombre: "Eric Niceto",              // nombre y apellidos, o razón social si algún día lo pones a nombre de una sociedad
  nif: "20906546Y",
  domicilio: "Camino la Plana 24, 12004 Castellón de la Plana, España",
  email: "soporte@yachtoday.com",
  web: "yachtoday.com",
};

const ACTUALIZADO = "12 de julio de 2026";

const faltanDatos = !TITULAR.nif || !TITULAR.domicilio;

function Aviso() {
  if (!faltanDatos) return null;
  return (
    <div className="legal-pendiente">
      <b>Esta página está incompleta.</b> Faltan el NIF y el domicilio del titular. No los
      hemos inventado: rellénalos en <code>src/Legal.jsx</code> antes de operar con clientes reales.
    </div>
  );
}

const Dato = ({ k, v }) => (
  <p><b>{k}:</b> {v || <span className="legal-hueco">pendiente de rellenar</span>}</p>
);

export function Legal({ seccion, onIr }) {
  const secciones = [
    ["aviso-legal", "Aviso legal"],
    ["privacidad", "Privacidad"],
    ["terminos", "Términos y condiciones"],
    ["cookies", "Cookies"],
  ];

  return (
    <div className="legal">
      <div className="legal-nav">
        {secciones.map(([id, t]) => (
          <button key={id} className={seccion === id ? "on" : ""} onClick={() => onIr(id)}>{t}</button>
        ))}
      </div>

      <div className="legal-txt">
        {seccion === "aviso-legal" && <AvisoLegal />}
        {seccion === "privacidad" && <Privacidad />}
        {seccion === "terminos" && <Terminos />}
        {seccion === "cookies" && <Cookies />}
        <p className="legal-fecha">Última actualización: {ACTUALIZADO}</p>
      </div>
    </div>
  );
}

function AvisoLegal() {
  return (
    <>
      <h1 className="serif">Aviso legal</h1>
      <Aviso />

      <h2>Quién está detrás de Yacht Today</h2>
      <Dato k="Titular" v={TITULAR.nombre} />
      <Dato k="NIF" v={TITULAR.nif} />
      <Dato k="Domicilio" v={TITULAR.domicilio} />
      <Dato k="Correo de contacto" v={TITULAR.email} />
      <Dato k="Sitio web" v={TITULAR.web} />

      <h2>Qué es esta web</h2>
      <p>
        Yacht Today es un <b>intermediario</b>. Pone en contacto a particulares que quieren
        alquilar su barco, su material náutico o guiar una experiencia, con personas que
        quieren disfrutar del mar.
      </p>
      <p>
        <b>Yacht Today no es propietaria de ninguna embarcación, no las opera y no presta el
        servicio de alquiler.</b> El contrato de alquiler se celebra entre el propietario y
        quien alquila. Yacht Today cobra una comisión por el servicio de intermediación y
        por gestionar el pago.
      </p>

      <h2>Uso del sitio</h2>
      <p>
        Al usar Yacht Today te comprometes a hacerlo conforme a la ley y a no publicar
        contenidos falsos, ni anuncios de embarcaciones que no sean tuyas o de las que no
        tengas derecho a disponer.
      </p>

      <h2>Legislación aplicable</h2>
      <p>
        Estas condiciones se rigen por la legislación española. Para cualquier controversia
        serán competentes los juzgados que correspondan según la normativa de consumidores.
      </p>
    </>
  );
}

function Privacidad() {
  return (
    <>
      <h1 className="serif">Política de privacidad</h1>
      <Aviso />

      <p>
        Aquí te contamos, sin rodeos, qué datos tuyos guardamos, para qué, cuánto tiempo y
        qué puedes exigirnos.
      </p>

      <h2>Quién trata tus datos</h2>
      <Dato k="Responsable" v={TITULAR.nombre} />
      <Dato k="NIF" v={TITULAR.nif} />
      <Dato k="Domicilio" v={TITULAR.domicilio} />
      <Dato k="Contacto" v={TITULAR.email} />

      <h2>Qué datos recogemos y por qué</h2>
      <table className="legal-tabla">
        <thead><tr><th>Qué</th><th>Para qué</th><th>Base legal</th></tr></thead>
        <tbody>
          <tr>
            <td>Correo electrónico, nombre y teléfono</td>
            <td>Crear tu cuenta, avisarte de tus reservas y poder contactarte</td>
            <td>Ejecución del contrato</td>
          </tr>
          <tr>
            <td>Datos de la reserva (fechas, importes, anuncio)</td>
            <td>Gestionar el alquiler y llevar la contabilidad</td>
            <td>Contrato y obligación legal</td>
          </tr>
          <tr>
            <td><b>Documentación del propietario</b>: matrícula, póliza de seguro, caducidad y los archivos que adjunta</td>
            <td>Comprobar, antes de publicar un anuncio, que la embarcación tiene los papeles en regla</td>
            <td>Interés legítimo en la seguridad de la plataforma, con tu consentimiento expreso al subirla</td>
          </tr>
          <tr>
            <td><b>Licencia de navegación</b> de quien alquila sin patrón</td>
            <td>Que el propietario pueda comprobar que quien se lleva su barco puede pilotarlo</td>
            <td>Consentimiento y seguridad</td>
          </tr>
          <tr>
            <td>Datos de pago</td>
            <td>Cobrar el alquiler y, si el propietario reporta daños, la fianza</td>
            <td>Ejecución del contrato</td>
          </tr>
        </tbody>
      </table>

      <h2>Tu tarjeta no la vemos</h2>
      <p>
        Los pagos los procesa <b>Stripe</b>. Los datos de tu tarjeta van directamente a
        Stripe: <b>Yacht Today nunca los recibe ni los almacena</b>. Cuando hay fianza, Stripe
        guarda tu tarjeta para poder cobrarla <i>solo</i> si el propietario reporta daños al
        terminar el alquiler — no se te cobra ni se te bloquea nada al reservar.
      </p>

      <h2>Quién más ve tus datos</h2>
      <ul>
        <li><b>Supabase</b> — donde vive la base de datos y los archivos (servidores en la UE).</li>
        <li><b>Stripe</b> — pagos y verificación de identidad de los propietarios que cobran.</li>
        <li><b>Resend</b> — envío de los correos de la plataforma.</li>
        <li><b>Vercel</b> — alojamiento de la web.</li>
        <li>
          <b>El propietario o el cliente de tu reserva</b>, y solo lo necesario: tu nombre y
          los datos de la reserva. Tu correo y tu teléfono no se le entregan.
        </li>
      </ul>
      <p>No vendemos tus datos a nadie. Nunca.</p>

      <h2>La documentación es privada de verdad</h2>
      <p>
        Los documentos que subes (póliza, matrícula, licencia) <b>no son públicos</b>. Se
        guardan en un almacén privado y solo pueden abrirlos su propio dueño y la persona que
        revisa los anuncios, mediante un enlace temporal que caduca a los dos minutos. No
        viajan por correo electrónico.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <ul>
        <li><b>Tu cuenta</b>: mientras la tengas abierta.</li>
        <li><b>Reservas y facturación</b>: 6 años, porque la ley mercantil nos obliga.</li>
        <li><b>Documentación de anuncios</b>: mientras el anuncio esté publicado. Al borrarlo, los archivos se eliminan de verdad.</li>
      </ul>

      <h2>Qué puedes exigirnos</h2>
      <p>
        Acceder a tus datos, corregirlos, borrarlos, limitar su uso, oponerte al tratamiento y
        pedir que te los entreguemos en un formato portable. Escribe a{" "}
        <a className="link-inline" href={`mailto:${TITULAR.email}`}>{TITULAR.email}</a> y te
        contestamos. Si crees que no lo hemos hecho bien, puedes reclamar ante la{" "}
        <a className="link-inline" href="https://www.aepd.es" target="_blank" rel="noreferrer">
          Agencia Española de Protección de Datos
        </a>.
      </p>

      <h2>Menores</h2>
      <p>Yacht Today no está dirigida a menores de 18 años y no permitimos que se registren.</p>
    </>
  );
}

function Terminos() {
  return (
    <>
      <h1 className="serif">Términos y condiciones</h1>

      <h2>Qué papel juega Yacht Today</h2>
      <p>
        Yacht Today <b>intermedia</b>: conecta al propietario con quien alquila, verifica la
        documentación antes de publicar un anuncio y gestiona el cobro. <b>El alquiler es un
        contrato entre el propietario y el cliente</b>, no con nosotros. Yacht Today no
        responde de la embarcación, de su estado ni de cómo se desarrolle la actividad.
      </p>

      <h2>La comisión</h2>
      <p>
        Yacht Today cobra un <b>15 % de gastos de servicio</b> que <b>paga quien alquila</b>,
        sumado al precio del propietario. El propietario <b>recibe su tarifa íntegra</b>.
        El desglose se muestra siempre antes de pagar.
      </p>

      <h2>La fianza: cómo funciona de verdad</h2>
      <p>
        En los alquileres sin patrón hay una fianza. <b>No se te cobra ni se te bloquea al
        reservar.</b> Al pagar, Stripe guarda tu tarjeta con tu consentimiento, y esa fianza
        <b> solo se te cobrará si el propietario reporta daños o pérdida al terminar el
        alquiler</b>, explicando qué ha pasado. Si todo está bien, no se te cobra nada.
      </p>
      <p>
        El propietario no puede reclamar la fianza antes de que el alquiler haya terminado, ni
        cobrarla dos veces.
      </p>

      <h2>Cancelaciones</h2>
      <ul>
        <li><b>Cancelas tú con más de 48 h</b>: se te devuelve el alquiler. Los gastos de servicio no se devuelven en ninguna cancelación.</li>
        <li><b>Cancelas tú con menos de 48 h</b>: pierdes además un 20 % del alquiler.</li>
        <li><b>Cancela el propietario</b>: se te devuelve <b>el importe íntegro del alquiler</b>. Las cancelaciones sin motivo justificado penalizan al propietario dentro de la plataforma.</li>
      </ul>

      <h2>Obligaciones del propietario</h2>
      <ul>
        <li>Que la embarcación sea suya o tenga derecho a alquilarla, y esté en condiciones de navegar.</li>
        <li>Tener el seguro en vigor y la documentación en regla, y aportarla cuando se le pida.</li>
        <li>Entregar lo que anuncia, en la fecha y el lugar acordados.</li>
        <li>Reclamar la fianza solo cuando haya un daño o una pérdida reales.</li>
      </ul>

      <h2>Obligaciones de quien alquila</h2>
      <ul>
        <li>Tener la titulación necesaria cuando el alquiler sea sin patrón, y acreditarla.</li>
        <li>Devolver lo alquilado en el mismo estado, salvo el desgaste normal.</li>
        <li>Respetar la normativa marítima y no poner en riesgo a nadie.</li>
      </ul>

      <h2>Antelación mínima</h2>
      <p>
        No se puede reservar en el último minuto y dejar al propietario sin margen: hay un
        mínimo de 3 h (barcos y material) o 24 h (experiencias), y el propietario puede exigir
        más. Además, <b>una reserva hecha entre las 22:00 y las 8:00 no puede empezar antes de
        pasado mañana</b>. Es una norma de seguridad y no se puede desactivar.
      </p>

      <h2>Revisión de anuncios</h2>
      <p>
        Todos los anuncios se revisan a mano antes de publicarse. Podemos rechazar uno
        explicando el motivo, y el propietario puede corregirlo y volver a enviarlo. Si un
        propietario cambia la documentación de un anuncio ya publicado, este vuelve a revisión.
      </p>

      <h2>Si algo va mal</h2>
      <p>
        Escríbenos a <a className="link-inline" href={`mailto:${TITULAR.email}`}>{TITULAR.email}</a>.
        Como consumidor, tienes derecho a acudir a las vías de resolución de conflictos que te
        reconoce la ley.
      </p>
    </>
  );
}

function Cookies() {
  return (
    <>
      <h1 className="serif">Cookies</h1>

      <h2>La versión corta</h2>
      <p>
        <b>Yacht Today no te rastrea.</b> No usamos cookies de publicidad, ni de análisis, ni
        compartimos tu navegación con nadie. Por eso <b>no te sale ningún cartel pidiéndote
        permiso</b>: no hay nada que consentir.
      </p>

      <h2>Lo único que guardamos en tu navegador</h2>
      <ul>
        <li>
          <b>Tu sesión.</b> Cuando inicias sesión, guardamos en tu propio navegador la
          credencial que te mantiene dentro. Sin eso tendrías que volver a entrar en cada
          página. Se borra al cerrar sesión.
        </li>
        <li>
          <b>Stripe.</b> Cuando pagas, lo haces en la página de Stripe, que usa sus propias
          cookies para evitar fraudes. Eso ocurre en su web, no en la nuestra, y está sujeto a
          la política de Stripe.
        </li>
      </ul>
      <p>
        Ambas cosas son <b>técnicamente necesarias</b> para que la web funcione. La ley no exige
        pedir consentimiento para ellas — y no lo pedimos porque sería un cartel inútil que
        molesta sin proteger a nadie.
      </p>
    </>
  );
}
