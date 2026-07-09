# Marea — contexto del proyecto

Marea es un **marketplace náutico entre particulares** para toda España. Conecta a
propietarios con personas que quieren disfrutar del mar. Lema: "Alquila el mar".

## Qué se puede publicar/reservar (3 clases)
1. **Barco** — se alquila por horas o por días, con o sin patrón.
2. **Experiencia** — el anfitrión NO deja el barco: te lleva él (pesca, submarinismo,
   ruta en paddle surf, kayak, atardecer). Se reserva **por persona**.
3. **Material** — tabla de paddle surf (SUP) o kayak que un particular alquila por horas/días.

## Modelo de negocio
- La plataforma cobra una **comisión de servicio del 15%** que paga quien alquila
  (se suma al precio del propietario; el propietario recibe su tarifa íntegra).
- Constante `COMISION` en `src/App.jsx`.

## Programa de recompensas (diferenciador)
- Clientes: niveles Explorer → Captain → Navigator → Admiral; descuento en gastos de
  gestión (3 alquileres = 50%, 5 = 100%); insignias y retos.
- Propietarios: "Cuida tu Barco" (3/10/20/40 alquileres → kits, revisiones, equipamiento);
  distintivo Propietario Premium.
- Idea estrella: "Recompensa Compartida" (al alcanzar un hito, se premia al propietario
  y a los clientes de ese barco).

## Stack actual
- Vite + React 18, iconos `lucide-react`. Todo en `src/App.jsx` (un solo componente).
- Datos y cuentas son de mentira (en memoria), sin backend todavía.

## Identidad visual (diseño "Marea", respétalo)
- Tipografías: titulares **Newsreader** (serif), interfaz **Hanken Grotesk** (importadas por CSS).
- Paleta: azul noche #16323F, azul mar #3E7CA6, azul brisa #7FB2CE, arena #F5EFE4,
  arena cálida #E7DFCF; acentos coral #D6706A, oro #E6C15F, salvia #7FB39A.

## Objetivo inmediato (backend real)
Convertir el prototipo en app funcional con **Firebase** (mismo enfoque que un proyecto
previo llamado NexControl):
1. **Firebase Auth** para registro/login reales (email/contraseña).
2. **Firestore** para perfiles de usuario, anuncios (barco/experiencia/material) y reservas.
3. **Storage** para las fotos de los anuncios.
4. Más adelante: **pagos** (Stripe Connect o Redsys) reteniendo la comisión del 15% y
   pagando al propietario; verificación de documentación (lista 6ª/7ª, seguro).

## Notas de trabajo
- El usuario (Eric) es no técnico: explica los pasos de forma sencilla y ve poco a poco.
- Antes de cambios grandes, propón un plan y espera su OK.
- Mantén el diseño y el desglose de precios con la comisión siempre visible.
