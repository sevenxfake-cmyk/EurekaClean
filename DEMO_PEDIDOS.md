# Pruebas: accesos, carrito y notificaciones de EurekaClean

## Estado actual

Esta versión es una demostración **sin autenticación real ni cobros**. Tiene accesos visibles en `login.html` para:
- **Invitado**: compra sin iniciar sesión.
- **Cliente Demo**: sesión simulada, carrito/historial en el navegador.
- **Administrador Demo**: vista y edición local de prueba, **sin permisos de servidor**.

Los productos provienen de `catalogo_exportado.json`. El cliente escoge cantidades y genera una **proforma ficticia** (no boleta ni factura SUNAT). El documento incluye productos, códigos, cantidades, subtotal e importe referencial.

En `proforma-enviar.html`:
- **Abrir WhatsApp con el pedido**: abre el chat de **+51 981 292 376** con el texto y total listos. El visitante debe pulsar **Enviar** dentro de WhatsApp. No adjunta el PDF automáticamente.
- **Preparar correo**: abre la aplicación de correo del visitante con destino a **eurekaverdeweb@gmail.com** y el resumen preparado. El visitante debe enviarlo.
- **Notificar automáticamente**: solo se activa si el endpoint `/api/order-notify` confirma que ambos servicios externos están configurados. De lo contrario se muestra como pendiente; **nunca se anuncia un envío inexistente**.
- **Descargar PDF**: utiliza la ventana de impresión del navegador; permite Guardar como PDF. No es un comprobante fiscal.

Los datos demo permanecen en `localStorage`. No hay pasarela de pagos, reservas de stock ni base de datos compartida.

## Cómo habilitar los envíos automáticos (todavía no configurados)

El endpoint `api/order-notify.js` valida códigos y precios contra el catálogo del servidor y solo entonces intenta notificar al comercio. **Los tokens deben guardarse como variables de entorno en Vercel, nunca en GitHub ni en el frontend.**

1. Crear cuenta en **Resend**, verificar un dominio remitente y configurar en el proyecto Vercel:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` (correo remitente de un dominio verificado)
2. Crear una integración con **WhatsApp Business Platform (Meta Cloud API)** y configurar:
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID` (identificador del número REMITENTE en Meta, no el celular destino)
   - `WHATSAPP_TEMPLATE_NAME` (plantilla aprobada para notificar pedidos)
   - `WHATSAPP_TEMPLATE_LANGUAGE` (opcional, por defecto `es_PE`)
   - `WHATSAPP_GRAPH_VERSION` (opcional; versión compatible del API)
3. La plantilla debe tener **4 variables de texto**, en este orden:
   1. Número / referencia de proforma
   2. Nombre del cliente
   3. Resumen de productos
   4. Importe total referencial
4. Al terminar las verificaciones y con autorización para notificaciones comerciales, configurar:
   - `ORDER_NOTIFICATIONS_ENABLED=true`
5. Volver a desplegar desde Vercel y verificar `GET /api/order-notify` que informe `ready: true`.

El destino del correo está fijado en el servidor en `eurekaverdeweb@gmail.com`; el destino WhatsApp en `51981292376`. El cliente no puede cambiarlos. Los precios los calcula el backend desde el catálogo, no desde valores manipulables en el navegador.

**Seguridad antes de abrirlo al público:** implementar Turnstile/CAPTCHA, limitación distribuida de peticiones, control de duplicados persistente y un flujo de consentimiento. El limitador actual del endpoint es solo temporal y por instancia, insuficiente para producción. Estas credenciales **no están configuradas todavía** y los mensajes **no se están enviando automáticamente**.

## Prueba manual

1. Abrir `https://eurekaclean.vercel.app/login.html` y usar uno de los tres accesos de prueba.
2. En `tienda.html`, agregar uno o varios productos.
3. Abrir `proforma.html`; indicar nombre y celular. RUC y dirección son opcionales en el demo.
4. Generar la proforma; se abre `proforma-enviar.html`.
5. Revisar el total, imprimir como PDF y preparar el mensaje de WhatsApp o correo.
6. Probar lo mismo sin iniciar sesión, y luego con Cliente Demo. Administrador Demo solo modifica datos en el navegador de prueba.
