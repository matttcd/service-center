// ============================================
// Seed inicial del servidor (service-center)
// Solo crea el usuario admin y el catálogo base.
// Los perfiles, clientes y órdenes se crean desde la app.
// ============================================
import bcrypt from 'bcryptjs'
import { uid } from './helpers.js'
import { prisma } from './db.js'

// ---------- Listas editables por defecto (Configuración) ----------
export const DEFAULT_LISTS = {
  accessories: ['Funda', 'Cargador', 'Vidrio templado', 'SIM', 'SD', 'Auriculares'],
  conditions: ['Apagado', 'Mojado', 'Golpeado', 'Display Roto', 'No se pudo probar funciones básicas'],
  fixes: ['Cambio de pantalla', 'Cambio de módulo', 'Cambio de batería', 'Pin de carga', 'Micrófono', 'Parlante', 'Botón de encendido', 'Flex', 'Software', 'Limpieza'],
  terms: [
    'Para la entrega del equipo, el cliente o un tercero asignado deberán presentar la <strong>orden</strong>. Si es un tercero, deberá contar con una <strong>autorización explícita</strong> del titular. Si el cliente no presenta la orden física, se podrá entregar el equipo con una constancia de retiro firmada (únicamente el cliente titular). Sin la <strong>orden original</strong> no se reconocerá garantía alguna.',
    'La garantía tiene una duración de <strong>treinta (30) días</strong> corridos desde el retiro y cubre exclusivamente las reparaciones detalladas en la presente orden.',
    'Transcurridos <strong>treinta (30) días</strong> desde la notificación de que el equipo está listo sin que haya sido retirado, El Gringo Celulares se reserva el derecho de modificar el presupuesto debido a variaciones en los costos de repuestos.',
    'Los pagos son exclusivamente <strong>en efectivo</strong>.',
    'Para cualquier duda o consulta sobre el estado de su dispositivo comunicarse al <strong>3704-583266</strong> o al <strong>3704-676320</strong>.',
    'Declaro haber leído y acepto las condiciones precedentemente descriptas.',
  ],
}

// ---------- Catálogo completo de dispositivos ----------

export const CATALOG = [
  // ── Samsung ──
  { brand: 'Samsung', deviceType: 'Celular', models: [
    'Galaxy S25', 'Galaxy S25+', 'Galaxy S25 Ultra', 'Galaxy S25 FE', 'Galaxy S25 Edge',
    'Galaxy S24', 'Galaxy S24+', 'Galaxy S24 Ultra', 'Galaxy S24 FE',
    'Galaxy S23', 'Galaxy S23+', 'Galaxy S23 Ultra', 'Galaxy S23 FE',
    'Galaxy S22', 'Galaxy S22+', 'Galaxy S22 Ultra',
    'Galaxy S21', 'Galaxy S21+', 'Galaxy S21 Ultra', 'Galaxy S21 FE',
    'Galaxy S20', 'Galaxy S20+', 'Galaxy S20 Ultra', 'Galaxy S20 FE',
    'Galaxy S10', 'Galaxy S10+', 'Galaxy S10e', 'Galaxy S10 Lite',
    'Galaxy S9', 'Galaxy S9+', 'Galaxy S8', 'Galaxy S8+',
    'Galaxy Note 20', 'Galaxy Note 20 Ultra', 'Galaxy Note 10', 'Galaxy Note 10+', 'Galaxy Note 10 Lite',
    'Galaxy Note 9', 'Galaxy Note 8',
    'Galaxy Z Flip 7', 'Galaxy Z Flip 6', 'Galaxy Z Flip 5', 'Galaxy Z Flip 5G', 'Galaxy Z Flip 4', 'Galaxy Z Flip 3', 'Galaxy Z Flip',
    'Galaxy Z Fold 7', 'Galaxy Z Fold 6', 'Galaxy Z Fold 5', 'Galaxy Z Fold 4', 'Galaxy Z Fold 3', 'Galaxy Z Fold 2', 'Galaxy Z Fold',
    'Galaxy A56 5G', 'Galaxy A55', 'Galaxy A54', 'Galaxy A53', 'Galaxy A52', 'Galaxy A52s', 'Galaxy A51', 'Galaxy A50',
    'Galaxy A36 5G', 'Galaxy A35', 'Galaxy A34', 'Galaxy A33', 'Galaxy A32', 'Galaxy A31', 'Galaxy A30',
    'Galaxy A26 5G', 'Galaxy A25', 'Galaxy A24', 'Galaxy A23', 'Galaxy A22', 'Galaxy A21', 'Galaxy A20',
    'Galaxy A16', 'Galaxy A15', 'Galaxy A14', 'Galaxy A13', 'Galaxy A12', 'Galaxy A11', 'Galaxy A10', 'Galaxy A10s',
    'Galaxy A06', 'Galaxy A05', 'Galaxy A04', 'Galaxy A03', 'Galaxy A02', 'Galaxy A01',
    'Galaxy A50s', 'Galaxy A40', 'Galaxy A42 5G', 'Galaxy A30s', 'Galaxy A20s', 'Galaxy A21s', 'Galaxy A80',
    'Galaxy A73 5G', 'Galaxy A72', 'Galaxy A71', 'Galaxy A70s', 'Galaxy A70',
    'Galaxy M56 5G', 'Galaxy M55', 'Galaxy M54', 'Galaxy M53', 'Galaxy M52', 'Galaxy M51', 'Galaxy M50',
    'Galaxy M36 5G', 'Galaxy M35', 'Galaxy M34', 'Galaxy M33', 'Galaxy M32', 'Galaxy M31', 'Galaxy M30',
    'Galaxy M16 5G', 'Galaxy M15', 'Galaxy M14', 'Galaxy M13', 'Galaxy M12', 'Galaxy M11', 'Galaxy M10',
    'Galaxy F56', 'Galaxy F55', 'Galaxy F54', 'Galaxy F36', 'Galaxy F34', 'Galaxy F23', 'Galaxy F22', 'Galaxy F16 5G', 'Galaxy F15', 'Galaxy F14', 'Galaxy F13', 'Galaxy F12', 'Galaxy F06 5G', 'Galaxy F05', 'Galaxy F04',
    'Galaxy Xcover 7', 'Galaxy Xcover 6 Pro', 'Galaxy Xcover 5', 'Galaxy Xcover 4s', 'Galaxy Xcover 4', 'Galaxy Xcover Pro',
    'Galaxy Tab S11', 'Galaxy Tab S11 Ultra', 'Galaxy Tab S10', 'Galaxy Tab S10+', 'Galaxy Tab S10 Ultra',
    'Galaxy Tab S10 FE', 'Galaxy Tab S10 FE+', 'Galaxy Tab S10 Lite',
    'Galaxy Tab S9', 'Galaxy Tab S9+', 'Galaxy Tab S9 Ultra', 'Galaxy Tab S9 FE', 'Galaxy Tab S9 FE+',
    'Galaxy Tab S8', 'Galaxy Tab S8+', 'Galaxy Tab S8 Ultra', 'Galaxy Tab S7', 'Galaxy Tab S7+', 'Galaxy Tab S7 FE',
    'Galaxy Tab S6', 'Galaxy Tab S6 Lite', 'Galaxy Tab S6 Lite 2024', 'Galaxy Tab S5e', 'Galaxy Tab S4', 'Galaxy Tab S3',
    'Galaxy Tab A9', 'Galaxy Tab A9+', 'Galaxy Tab A8', 'Galaxy Tab A7', 'Galaxy Tab A7 Lite', 'Galaxy Tab A 10.5',
    'Galaxy Tab Active5', 'Galaxy Tab Active4 Pro', 'Galaxy Tab Active3', 'Galaxy Tab Active2',
    'Galaxy Book4 Pro', 'Galaxy Book4 360', 'Galaxy Book4 Ultra', 'Galaxy Book4 Edge', 'Galaxy Book4',
    'Galaxy Book3 Pro', 'Galaxy Book3 360', 'Galaxy Book3 Ultra', 'Galaxy Book3',
    'Galaxy Book2 Pro', 'Galaxy Book2 Pro 360', 'Galaxy Book2',
    'Galaxy Book Pro', 'Galaxy Book Pro 360', 'Galaxy Book Flex', 'Galaxy Book Ion', 'Galaxy Book',
  ]},

  // ── Apple ──
  { brand: 'Apple', deviceType: 'Celular', models: [
    'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 16e',
    'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
    'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
    'iPhone 13', 'iPhone 13 mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
    'iPhone 12', 'iPhone 12 mini', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
    'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
    'iPhone XR', 'iPhone XS', 'iPhone XS Max', 'iPhone X',
    'iPhone SE 2022', 'iPhone SE 2020', 'iPhone SE 2016', 'iPhone SE 4',
    'iPhone 8', 'iPhone 8 Plus', 'iPhone 7', 'iPhone 7 Plus',
    'iPhone 6s', 'iPhone 6s Plus', 'iPhone 6', 'iPhone 6 Plus',
    'iPad Pro 13" M4', 'iPad Pro 12.9" M4', 'iPad Pro 11" M4', 'iPad Pro 12.9"', 'iPad Pro 11"', 'iPad Pro 10.5"', 'iPad Pro 9.7"',
    'iPad Air 13" M3', 'iPad Air 11" M3', 'iPad Air 13" M2', 'iPad Air 11" M2',
    'iPad Air 6', 'iPad Air 5', 'iPad Air 4', 'iPad Air 3', 'iPad Air 2',
    'iPad (A16)', 'iPad 10', 'iPad 9', 'iPad 8', 'iPad 7', 'iPad 6', 'iPad 5',
    'iPad mini (A17 Pro)', 'iPad mini 7', 'iPad mini 6', 'iPad mini 5', 'iPad mini 4',
    'MacBook Air 15" M4', 'MacBook Air 13" M4', 'MacBook Air M3', 'MacBook Air M2', 'MacBook Air M1',
    'MacBook Pro 16" M4', 'MacBook Pro 14" M4', 'MacBook Pro 16" M3', 'MacBook Pro 14" M3',
    'MacBook Pro 16" M2', 'MacBook Pro 14" M2', 'MacBook Pro 13" M2', 'MacBook Pro 13" M1',
    'iMac 24"', 'iMac 27"', 'iMac 21.5"',
    'Mac Mini', 'Mac Studio', 'Mac Pro',
    'Apple Watch Ultra 2', 'Apple Watch Ultra', 'Apple Watch Series 10', 'Apple Watch Series 9',
    'Apple Watch Series 8', 'Apple Watch Series 7', 'Apple Watch Series 6', 'Apple Watch Series 5',
    'Apple Watch SE 2', 'Apple Watch SE',
    'Apple TV 4K', 'Apple TV HD',
    'AirPods Max', 'AirPods Pro 2', 'AirPods Pro', 'AirPods 4', 'AirPods 3', 'AirPods 2',
  ]},

  // ── Xiaomi ──
  { brand: 'Xiaomi', deviceType: 'Celular', models: [
    'Xiaomi 15', 'Xiaomi 15 Pro', 'Xiaomi 15 Ultra', 'Xiaomi 14', 'Xiaomi 14 Pro', 'Xiaomi 14 Ultra',
    'Xiaomi 13', 'Xiaomi 13 Pro', 'Xiaomi 13 Lite', 'Xiaomi 13T', 'Xiaomi 13T Pro',
    'Xiaomi 12', 'Xiaomi 12 Pro', 'Xiaomi 12T', 'Xiaomi 12T Pro', 'Xiaomi 12 Lite',
    'Xiaomi 11', 'Xiaomi 11 Lite 5G', 'Xiaomi 11T', 'Xiaomi 11T Pro',
    'Redmi Note 15', 'Redmi Note 15 5G', 'Redmi Note 15 Pro', 'Redmi Note 15 Pro+ 5G',
    'Redmi Note 14', 'Redmi Note 14 5G', 'Redmi Note 14 Pro', 'Redmi Note 14 Pro 5G', 'Redmi Note 14 Pro+ 5G',
    'Redmi Note 13', 'Redmi Note 13 5G', 'Redmi Note 13 Pro', 'Redmi Note 13 Pro 5G', 'Redmi Note 13 Pro+',
    'Redmi Note 12', 'Redmi Note 12 5G', 'Redmi Note 12 Pro', 'Redmi Note 12 Pro 5G', 'Redmi Note 12 Pro+', 'Redmi Note 12S', 'Redmi Note 12 Turbo',
    'Redmi Note 11', 'Redmi Note 11 Pro', 'Redmi Note 11 Pro+', 'Redmi Note 11S', 'Redmi Note 11T',
    'Redmi Note 10', 'Redmi Note 10 Pro', 'Redmi Note 10S', 'Redmi Note 10 5G',
    'Redmi Note 9', 'Redmi Note 9 Pro', 'Redmi Note 9S', 'Redmi Note 9T',
    'Redmi Note 8', 'Redmi Note 8 Pro', 'Redmi Note 8T',
    'Redmi 15', 'Redmi 15C', 'Redmi 14', 'Redmi 14C', 'Redmi 14 Pro', 'Redmi 14 5G',
    'Redmi 13', 'Redmi 13C', 'Redmi 13 5G', 'Redmi 12', 'Redmi 12C', 'Redmi 11', 'Redmi 11 Prime',
    'Redmi 10', 'Redmi 10C', 'Redmi 10 2022',
    'Redmi 9', 'Redmi 9A', 'Redmi 9C', 'Redmi 9T', 'Redmi 9 Power',
    'Redmi 8', 'Redmi 8A', 'Redmi 8A Dual', 'Redmi 7', 'Redmi 7A', 'Redmi 6', 'Redmi 6A',
    'Redmi A4', 'Redmi A3', 'Redmi A3x', 'Redmi A2', 'Redmi A2+', 'Redmi A1',
    'POCO F7', 'POCO F7 Pro', 'POCO F7 Ultra', 'POCO F6', 'POCO F6 Pro',
    'POCO F5', 'POCO F5 Pro', 'POCO F4', 'POCO F4 GT', 'POCO F3', 'POCO F3 GT',
    'POCO X7', 'POCO X7 Pro', 'POCO X6', 'POCO X6 Pro', 'POCO X5', 'POCO X5 Pro',
    'POCO X4', 'POCO X4 GT', 'POCO X3', 'POCO X3 NFC', 'POCO X3 Pro',
    'POCO M7', 'POCO M7 Pro 5G', 'POCO M6 Pro', 'POCO M6', 'POCO M5', 'POCO M5s',
    'POCO M4', 'POCO M4 Pro', 'POCO M4 Pro 5G', 'POCO M3', 'POCO M3 Pro',
    'POCO C75', 'POCO C65', 'POCO C55', 'POCO C51', 'POCO C50', 'POCO C40', 'POCO C31', 'POCO C3',
    'POCO Pad',
    'Redmi Pad SE', 'Redmi Pad Pro', 'Redmi Pad', 'Xiaomi Pad 6', 'Xiaomi Pad 6 Pro', 'Xiaomi Pad 6S Pro', 'Xiaomi Pad 5',
  ]},

  // ── Motorola ──
  { brand: 'Motorola', deviceType: 'Celular', models: [
    'Edge 60', 'Edge 60 Fusion', 'Edge 60 Neo', 'Edge 60 Pro',
    'Edge 50', 'Edge 50 Pro', 'Edge 50 Ultra', 'Edge 50 Fusion', 'Edge 50 Neo',
    'Edge 40', 'Edge 40 Pro', 'Edge 40 Neo', 'Edge 30', 'Edge 30 Pro', 'Edge 30 Ultra', 'Edge 30 Neo',
    'Edge 20', 'Edge 20 Pro', 'Edge 20 Lite', 'Edge+', 'Edge',
    'Razr 50', 'Razr Ultra', 'Razr+ 2024', 'Razr 2024', 'Razr+ 2023', 'Razr 2023', 'Razr 5G', 'Razr',
    'Moto G96', 'Moto G86 5G', 'Moto G85', 'Moto G84', 'Moto G82', 'Moto G81', 'Moto G80',
    'Moto G75 5G', 'Moto G73', 'Moto G72', 'Moto G71', 'Moto G70',
    'Moto G66 5G', 'Moto G64', 'Moto G56 5G', 'Moto G55', 'Moto G54', 'Moto G53', 'Moto G52', 'Moto G51', 'Moto G50',
    'Moto G45', 'Moto G42', 'Moto G41', 'Moto G40',
    'Moto G35', 'Moto G34', 'Moto G33', 'Moto G32', 'Moto G31', 'Moto G30',
    'Moto G24', 'Moto G24 5G', 'Moto G23', 'Moto G22', 'Moto G20',
    'Moto G14', 'Moto G13', 'Moto G12', 'Moto G11', 'Moto G10', 'Moto G9', 'Moto G8', 'Moto G7',
    'Moto G06', 'Moto G05', 'Moto G04s', 'Moto G04',
    'Moto E14', 'Moto E13', 'Moto E12', 'Moto E11', 'Moto E10', 'Moto E9', 'Moto E8', 'Moto E7',
    'Moto E7 Plus', 'Moto E6s', 'Moto E6 Play', 'Moto E6i', 'Moto E6',
    'Moto G Stylus 2024', 'Moto G Stylus 2023', 'Moto G Power 2024', 'Moto G Power 2023',
    'Moto G Play 2024', 'Moto G Play 2023',
    'ThinkPhone', 'Moto Tab G62', 'Moto Tab G70', 'Lenovo Tab M10',
  ]},

  // ── LG ──
  { brand: 'LG', deviceType: 'Celular', models: [
    'Wing', 'Velvet', 'V60 ThinQ', 'V50 ThinQ', 'V40 ThinQ', 'V30+', 'V30', 'V20', 'V10',
    'G8 ThinQ', 'G7 ThinQ', 'G6', 'G5', 'G4', 'G3', 'G2',
    'K71', 'K62', 'K61', 'K52', 'K51', 'K50', 'K42', 'K41', 'K40', 'K32', 'K31', 'K30', 'K22', 'K20', 'K12+', 'K11', 'K10', 'K9',
    'Stylus 6', 'Stylus 5', 'Stylus 4', 'Stylus 3',
    'Q Stylus+', 'Q Stylus', 'Q Stylo 4',
    'X screen', 'X cam', 'X power', 'X style',
    'LG ThinQ', 'LG Phoenix', 'LG Aristo', 'LG Arena', 'LG Optimus',
    'LG G Pad 5', 'LG G Pad IV', 'LG G Pad III', 'LG G Pad X',
  ]},

  // ── Nokia ──
  { brand: 'Nokia', deviceType: 'Celular', models: [
    'Nokia 8.3', 'Nokia 8.1', 'Nokia 8 Sirocco', 'Nokia 8',
    'Nokia 7.2', 'Nokia 7.1', 'Nokia 7 Plus', 'Nokia 7',
    'Nokia 6.2', 'Nokia 6.1', 'Nokia 6.1 Plus', 'Nokia 6',
    'Nokia 5.4', 'Nokia 5.3', 'Nokia 5.1 Plus', 'Nokia 5.1', 'Nokia 5',
    'Nokia 4.2', 'Nokia 4', 'Nokia 3.4', 'Nokia 3.2', 'Nokia 3.1 Plus', 'Nokia 3.1', 'Nokia 3',
    'Nokia 2.4', 'Nokia 2.3', 'Nokia 2.2', 'Nokia 2.1', 'Nokia 2',
    'Nokia 1.4', 'Nokia 1.3', 'Nokia 1.2', 'Nokia 1',
    'Nokia C32', 'Nokia C31', 'Nokia C30', 'Nokia C22', 'Nokia C21', 'Nokia C20', 'Nokia C12', 'Nokia C12 Pro', 'Nokia C10', 'Nokia C1',
    'Nokia C210', 'Nokia C300',
    'Nokia G60', 'Nokia G50', 'Nokia G42', 'Nokia G400', 'Nokia G310 5G', 'Nokia G22', 'Nokia G21', 'Nokia G20', 'Nokia G11', 'Nokia G10', 'Nokia G100',
    'Nokia X30', 'Nokia X20', 'Nokia X10',
    'Nokia 9 PureView', 'Nokia 9',
    'Nokia Lumia 1520', 'Nokia Lumia 1020', 'Nokia Lumia 950', 'Nokia Lumia 930', 'Nokia Lumia 925', 'Nokia Lumia 920',
    'Nokia Lumia 830', 'Nokia Lumia 820', 'Nokia Lumia 735', 'Nokia Lumia 730', 'Nokia Lumia 720',
    'Nokia Lumia 640', 'Nokia Lumia 635', 'Nokia Lumia 630', 'Nokia Lumia 625', 'Nokia Lumia 620',
    'Nokia Lumia 535', 'Nokia Lumia 530', 'Nokia Lumia 525', 'Nokia Lumia 520', 'Nokia Lumia 510',
    'Nokia XR21', 'Nokia XR20',
    'Nokia 3310', 'Nokia 215', 'Nokia 216', 'Nokia 225', 'Nokia 230',
    'Nokia C12 Pro', 'Nokia G11 Plus', 'Nokia C01 Plus',
  ]},

  // ── Huawei ──
  { brand: 'Huawei', deviceType: 'Celular', models: [
    'Pura 70', 'Pura 70 Pro', 'Pura 70 Ultra', 'Pura 70 Pro+',
    'P60', 'P60 Pro', 'P60 Art', 'P50', 'P50 Pro', 'P50 Pocket',
    'P40', 'P40 Pro', 'P40 Pro+', 'P40 Lite', 'P40 Lite E', 'P40 Lite 5G',
    'P30', 'P30 Pro', 'P30 Lite', 'P30 Lite New Edition',
    'P20', 'P20 Pro', 'P20 Lite',
    'P10', 'P10 Plus', 'P10 Lite',
    'Mate 70', 'Mate 70 Pro', 'Mate 60', 'Mate 60 Pro', 'Mate 60 Pro+', 'Mate 60 RS',
    'Mate 50', 'Mate 50 Pro', 'Mate 50 RS',
    'Mate 40', 'Mate 40 Pro', 'Mate 40 Pro+', 'Mate 40 RS',
    'Mate 30', 'Mate 30 Pro', 'Mate 30 5G', 'Mate 30 Pro 5G',
    'Mate 20', 'Mate 20 Pro', 'Mate 20 X', 'Mate 20 Lite',
    'Mate 10', 'Mate 10 Pro', 'Mate 9', 'Mate 9 Pro',
    'Nova 13', 'Nova 13 Pro', 'Nova 12', 'Nova 12 Pro', 'Nova 12s', 'Nova 12i',
    'Nova 11', 'Nova 11 Pro', 'Nova 11i', 'Nova 11 SE',
    'Nova 10', 'Nova 10 Pro', 'Nova 10 SE', 'Nova 10i',
    'Nova 9', 'Nova 9 Pro', 'Nova 9 SE', 'Nova 9i',
    'Nova 8', 'Nova 8 Pro', 'Nova 8 SE', 'Nova 8i',
    'Nova 7', 'Nova 7 Pro', 'Nova 7 SE', 'Nova 7i',
    'Y9a', 'Y9s', 'Y9 Prime 2019',
    'Y8', 'Y7', 'Y6', 'Y5', 'Y3',
    'Y9 2019', 'Y9 Prime 2020', 'Y9a 2021',
    'Enjoy 50', 'Enjoy 60', 'Enjoy 70', 'Enjoy 70 Pro',
    'MatePad 11', 'MatePad Pro 11', 'MatePad 10.4', 'MatePad T10', 'MatePad T8',
    'MateBook X Pro', 'MateBook X', 'MateBook 14', 'MateBook D 14', 'MateBook D 15', 'MateBook B',
  ]},

  // ── Google ──
  { brand: 'Google', deviceType: 'Celular', models: [
    'Pixel 9a', 'Pixel 9', 'Pixel 9 Pro', 'Pixel 9 Pro Fold', 'Pixel 9 Pro XL',
    'Pixel 8', 'Pixel 8 Pro', 'Pixel 8a',
    'Pixel 7', 'Pixel 7 Pro', 'Pixel 7a',
    'Pixel 6', 'Pixel 6 Pro', 'Pixel 6a',
    'Pixel 5', 'Pixel 5a',
    'Pixel 4', 'Pixel 4 XL', 'Pixel 4a',
    'Pixel 3', 'Pixel 3 XL', 'Pixel 3a', 'Pixel 3a XL',
    'Pixel 2', 'Pixel 2 XL',
    'Pixel', 'Pixel XL',
    'Pixel Tablet',
    'Pixel Buds Pro 2', 'Pixel Buds Pro', 'Pixel Buds A-series',
    'Pixel Watch 3', 'Pixel Watch 2', 'Pixel Watch',
    'Pixel Fold',
  ]},

  // ── Sony ──
  { brand: 'Sony', deviceType: 'Celular', models: [
    'Xperia 1 VI', 'Xperia 1 V', 'Xperia 1 IV', 'Xperia 1 III', 'Xperia 1 II', 'Xperia 1',
    'Xperia 5 V', 'Xperia 5 IV', 'Xperia 5 III', 'Xperia 5 II', 'Xperia 5',
    'Xperia 10 VI', 'Xperia 10 V', 'Xperia 10 IV', 'Xperia 10 III', 'Xperia 10 II', 'Xperia 10',
    'Xperia 5 V', 'Xperia Ace III', 'Xperia Ace II', 'Xperia Ace',
    'Xperia PRO-I', 'Xperia PRO',
    'Xperia XZ3', 'Xperia XZ2', 'Xperia XZ1', 'Xperia XZ', 'Xperia XZ Premium',
    'Xperia XA2', 'Xperia XA1', 'Xperia X', 'Xperia X Compact',
    'Xperia Z5', 'Xperia Z5 Premium', 'Xperia Z5 Compact',
    'Xperia Z4', 'Xperia Z3', 'Xperia Z3 Compact', 'Xperia Z3+', 'Xperia Z2', 'Xperia Z1', 'Xperia Z',
  ]},

  // ── OnePlus ──
  { brand: 'OnePlus', deviceType: 'Celular', models: [
    'OnePlus 13', 'OnePlus 13R', 'OnePlus 12', 'OnePlus 12R',
    'OnePlus 11', 'OnePlus 11R', 'OnePlus 10 Pro', 'OnePlus 10T', 'OnePlus 10R',
    'OnePlus 9', 'OnePlus 9 Pro', 'OnePlus 9R', 'OnePlus 9RT',
    'OnePlus 8T', 'OnePlus 8 Pro', 'OnePlus 8',
    'OnePlus 7T Pro', 'OnePlus 7T', 'OnePlus 7 Pro', 'OnePlus 7',
    'OnePlus 6T', 'OnePlus 6', 'OnePlus 5T', 'OnePlus 5', 'OnePlus 3T', 'OnePlus 3', 'OnePlus 2', 'OnePlus One',
    'Nord 4', 'Nord 3',     'Nord CE 4', 'Nord CE 4 Lite', 'Nord CE 3', 'Nord CE 3 Lite', 'Nord CE 2', 'Nord CE 2 Lite',
    'Nord 5', 'Nord N30', 'Nord N20', 'Nord N10', 'Nord N100',
    'Nord 2', 'Nord 2T', 'Nord N200',
    'Open',
  ]},

  // ── Realme ──
  { brand: 'Realme', deviceType: 'Celular', models: [
    'GT 6', 'GT 6T', 'GT 5 Pro', 'GT 5', 'GT 3', 'GT 2 Pro', 'GT 2', 'GT Master Edition',
    '13 Pro+', '13 Pro', '13', '12 Pro+', '12 Pro', '12', '11 Pro+', '11 Pro', '11',
    '10 Pro+', '10 Pro', '10', '9 Pro+', '9 Pro', '9', '8 Pro', '8', '8i', '8s',
    '7 Pro', '7', '6 Pro', '6', '5 Pro', '5', '3 Pro', '3',
    'C67', 'C65', 'C63', 'C55', 'C53', 'C51', 'C50', 'C35', 'C33', 'C31', 'C30', 'C25', 'C21', 'C20', 'C15', 'C12', 'C11',
    'Narzo 70', 'Narzo 70x', 'Narzo 60', 'Narzo 50', 'Narzo 30', 'Narzo 20', 'Narzo 10',
    'Pad 6', 'Pad 6 Pro', 'Pad 5G', 'Pad',
  ]},

  // ── Oppo ──
  { brand: 'Oppo', deviceType: 'Celular', models: [
    'Find X7', 'Find X7 Ultra', 'Find X6', 'Find X6 Pro', 'Find X5', 'Find X5 Pro',
    'Find N3', 'Find N3 Flip', 'Find N2', 'Find N2 Flip', 'Find N',
    'Reno 12', 'Reno 12 Pro', 'Reno 11', 'Reno 11 Pro', 'Reno 11F',
    'Reno 10', 'Reno 10 Pro', 'Reno 10 Pro+', 'Reno 9', 'Reno 9 Pro', 'Reno 9 Pro+',
    'Reno 8', 'Reno 8 Pro', 'Reno 8T', 'Reno 7', 'Reno 7 Pro', 'Reno 7A', 'Reno 6', 'Reno 6 Pro',
    'Reno 5', 'Reno 5 Pro', 'Reno 4', 'Reno 4 Pro', 'Reno 3', 'Reno 3 Pro',
    'Reno 2', 'Reno 2Z', 'Reno 10x Zoom', 'Reno', 'Reno Z',
    'A98', 'A96', 'A95', 'A93', 'A92', 'A91', 'A9', 'A78', 'A77', 'A76', 'A74', 'A72', 'A58', 'A57', 'A55', 'A54', 'A53', 'A52', 'A38', 'A18', 'A17', 'A16', 'A15', 'A12', 'A11', 'A5s',
    'Pad 2', 'Pad Air',
  ]},

  // ── Vivo ──
  { brand: 'Vivo', deviceType: 'Celular', models: [
    'X100', 'X100 Pro', 'X90', 'X90 Pro', 'X80', 'X80 Pro', 'X70', 'X70 Pro',
    'V30', 'V30 Lite', 'V30 Pro', 'V29', 'V29 Lite', 'V29 Pro', 'V27', 'V27 Lite', 'V27 Pro',
    'V25', 'V25 Pro', 'V25e', 'V23', 'V23 Pro', 'V21', 'V21 5G', 'V20',
    'Y36', 'Y35', 'Y33', 'Y33s', 'Y27', 'Y22', 'Y21', 'Y20', 'Y18', 'Y17', 'Y16', 'Y15', 'Y12', 'Y11', 'Y10',
    'T3', 'T2', 'T1',
    'iQOO 13', 'iQOO 12', 'iQOO 11', 'iQOO 9', 'iQOO 7', 'iQOO Z9', 'iQOO Z7', 'iQOO Z6', 'iQOO Z5', 'iQOO Z3',
    'Pad 3', 'Pad 2 Pro',
  ]},

  // ── Honor ──
  { brand: 'Honor', deviceType: 'Celular', models: [
    'Magic6 Pro', 'Magic6', 'Magic5 Pro', 'Magic5', 'Magic4 Pro', 'Magic4', 'Magic V2', 'Magic Vs',
    '200', '200 Pro', '100', '100 Pro', '90', '90 Pro', '80', '80 Pro', '80 GT',
    '70', '70 Pro', '70 Lite', '60', '60 Pro', '50', '50 Pro', '50 Lite',
    'X9b', 'X9a', 'X9', 'X8b', 'X8', 'X7b', 'X7a', 'X7', 'X6b', 'X6a', 'X6', 'X5 Plus', 'X5',
    'Play 5', 'Play 4T', 'Play 4',
    'X40', 'X30', 'X20', 'X10',
    'Pad 9', 'Pad 8', 'Pad 7', 'Pad X8 Lite',
    'MagicBook 14', 'MagicBook 15', 'MagicBook X 14', 'MagicBook X 16',
  ]},

  // ── Alcatel ──
  { brand: 'Alcatel', deviceType: 'Celular', models: [
    '1S', '1V', '1', '3L', '3', '3X', '3V',
    '5', '5V', '5X',
    '1T 10', '1T 7', '3T 10', '3T 8',
    'A7 XL', 'A7', 'A5 LED', 'A30', 'A50', 'A20', 'A10',
    'Pixi 4', 'Pixi 3', 'Pop 4', 'Pop 3', 'Pop 2',
  ]},

  // ── ZTE ──
  { brand: 'ZTE', deviceType: 'Celular', models: [
    'Axon 40 Ultra', 'Axon 30', 'Axon 20', 'Blade V40', 'Blade V30', 'Blade 20',
    'Blade A72', 'Blade A52', 'Blade A31', 'Blade A21', 'Blade A11', 'Blade L8',
    'ZTE Blade', 'ZTE Maven', 'ZTE Prestige',
  ]},

  // ── TECNO ──
  { brand: 'TECNO', deviceType: 'Celular', models: [
    'Phantom V Fold', 'Phantom V Flip', 'Phantom X2', 'Phantom 9',
    'Camon 30', 'Camon 30 Pro', 'Camon 20', 'Camon 20 Pro', 'Camon 19', 'Camon 19 Pro', 'Camon 18', 'Camon 17',
    'Spark 20', 'Spark 20 Pro', 'Spark 10', 'Spark 10 Pro', 'Spark 9', 'Spark 8', 'Spark 7',
    'Pop 7', 'Pop 5', 'Pop 4',
    'Pova 6', 'Pova 5', 'Pova 4', 'Pova 3', 'Pova 2',
  ]},

  // ── Infinix ──
  { brand: 'Infinix', deviceType: 'Celular', models: [
    'Note 40', 'Note 40 Pro', 'Note 30', 'Note 30 Pro', 'Note 12', 'Note 12 Pro',
    'Hot 40', 'Hot 40 Pro', 'Hot 30', 'Hot 30i', 'Hot 20', 'Hot 20S', 'Hot 12', 'Hot 11', 'Hot 10',
    'Smart 8', 'Smart 7', 'Smart 6', 'Smart 5',
    'Zero 30', 'Zero 20', 'Zero 5G', 'Zero 8',
    'GT 20 Pro', 'GT 10 Pro',
  ]},

  // ── Meizu ──
  { brand: 'Meizu', deviceType: 'Celular', models: [
    '21 Pro', '20 Pro', '20', '18 Pro', '18', '17 Pro', '17',
    'Note 21', 'Note 20', 'Note 12', 'Note 11', 'Note 9', 'Note 8',
    '16T', '16s', '16X', '15', 'PRO 7',
  ]},

  // ── Nothing ──
  { brand: 'Nothing', deviceType: 'Celular', models: [
    'Phone (2a)', 'Phone (2)', 'Phone (1)',
    'Ear (2)', 'Ear (a)', 'Ear (1)',
  ]},

  // ── Asus ──
  { brand: 'Asus', deviceType: 'Celular', models: [
    'ROG Phone 8', 'ROG Phone 8 Pro', 'ROG Phone 7', 'ROG Phone 7 Ultimate', 'ROG Phone 6', 'ROG Phone 5', 'ROG Phone 3',
    'Zenfone 11', 'Zenfone 10', 'Zenfone 9', 'Zenfone 8', 'Zenfone 8 Flip',
    'Zenfone 7', 'Zenfone 7 Pro', 'Zenfone 6', 'Zenfone 5Z', 'Zenfone 5',
    'ZenPad',
  ]},

  // ── Lenovo ──
  { brand: 'Lenovo', deviceType: 'Notebook / PC', models: [
    'Legion 9i', 'Legion 7i', 'Legion 5i', 'Legion Pro 7i', 'Legion Pro 5i',
    'Legion 5', 'Legion 7', 'Legion Slim 5', 'Legion Slim 7',
    'IdeaPad 3', 'IdeaPad 5', 'IdeaPad Slim 3', 'IdeaPad Slim 5',
    'IdeaPad Gaming 3', 'IdeaPad Flex 5',
    'ThinkPad X1 Carbon', 'ThinkPad X1 Yoga', 'ThinkPad X13', 'ThinkPad X14',
    'ThinkPad T14', 'ThinkPad T15', 'ThinkPad T490', 'ThinkPad T480',
    'ThinkPad E14', 'ThinkPad E15', 'ThinkPad L14', 'ThinkPad L15',
    'Tab P12', 'Tab P11', 'Tab P11 Pro', 'Tab M10', 'Tab M9', 'Tab M8',
    'Yoga Tab 13', 'Yoga Tab 11',
  ]},

  // ── Dell ──
  { brand: 'Dell', deviceType: 'Notebook / PC', models: [
    'XPS 15', 'XPS 14', 'XPS 13', 'XPS 13 Plus', 'XPS 17',
    'Inspiron 15', 'Inspiron 14', 'Inspiron 16', 'Inspiron 13', 'Inspiron 3000', 'Inspiron 5000', 'Inspiron 7000',
    'Latitude 5540', 'Latitude 5440', 'Latitude 7440', 'Latitude 7490', 'Latitude 5400', 'Latitude 5490',
    'Precision 5680', 'Precision 5570', 'Precision 7680', 'Precision 7780',
    'Vostro 3510', 'Vostro 3400', 'Vostro 5471',
    'G16', 'G15', 'G14',
    'Alienware m18', 'Alienware m16', 'Alienware x16', 'Alienware x14',
  ]},

  // ── HP ──
  { brand: 'HP', deviceType: 'Notebook / PC', models: [
    'Spectre x360 16', 'Spectre x360 14', 'Spectre x360 13', 'Spectre 14', 'Spectre 13',
    'Envy x360 15', 'Envy x360 13', 'Envy 16', 'Envy 14', 'Envy 13',
    'Pavilion 15', 'Pavilion 14', 'Pavilion 16', 'Pavilion x360',
    'ProBook 450', 'ProBook 440', 'ProBook 650', 'ProBook 640',
    'EliteBook 840', 'EliteBook 850', 'EliteBook 1040', 'EliteBook x360',
    'Victus 16', 'Victus 15',
    'Omen 16', 'Omen 17', 'Omen 18',
    'ZBook Studio', 'ZBook Fury', 'ZBook Power',
    'Pavilion Plus 14',
  ]},

  // ── Acer ──
  { brand: 'Acer', deviceType: 'Notebook / PC', models: [
    'Predator Helios 18', 'Predator Helios 16', 'Predator Helios Neo',
    'Predator Triton', 'Predator 17', 'Predator 15',
    'Nitro V 16', 'Nitro V 15', 'Nitro 5', 'Nitro 7', 'Nitro 3',
    'Aspire 5', 'Aspire 3', 'Aspire 7', 'Aspire V15', 'Aspire V17',
    'Swift 3', 'Swift 5', 'Swift Go 14', 'Swift Go 16',
    'Chromebook 314', 'Chromebook 315', 'Chromebook Spin',
    'Enduro', 'TravelMate P4', 'TravelMate X3',
  ]},

  // ── Huawei notebooks ── (continuación de arriba si se necesitaba)

  // ── Microsoft ──
  { brand: 'Microsoft', deviceType: 'Notebook / PC', models: [
    'Surface Pro 11', 'Surface Pro 10', 'Surface Pro 9', 'Surface Pro 8', 'Surface Pro 7', 'Surface Pro X',
    'Surface Laptop 7', 'Surface Laptop 6', 'Surface Laptop 5', 'Surface Laptop 4', 'Surface Laptop 3',
    'Surface Laptop Go 3', 'Surface Laptop Go 2', 'Surface Laptop Go',
    'Surface Go 4', 'Surface Go 3', 'Surface Go 2', 'Surface Go',
    'Surface Book 3', 'Surface Book 2', 'Surface Book',
    'Surface Studio 2', 'Surface Studio',
  ]},

  // ── Samsung notebooks ── (continuación de arriba)

  // ── Otros / Genéricos ──
  { brand: 'Blu', deviceType: 'Celular', models: [
    'Blu G91', 'Blu G90', 'Blu G80', 'Blu G50', 'Blu G30',
    'Blu Vivo X6', 'Blu Vivo X5', 'Blu Vivo XII', 'Blu Vivo XI',
    'Blu Studio X10', 'Blu Studio 8', 'Blu Bold N2', 'Blu Bold Play',
  ]},

  { brand: 'Cricket', deviceType: 'Celular', models: [
    'Cricket Spark', 'Cricket Innovate', 'Cricket Ollie', 'Cricket Icon 5',
  ]},

  { brand: 'TCL', deviceType: 'Celular', models: [
    'TCL 50 XL', 'TCL 50 XE', 'TCL 40 SE', 'TCL 40 NxtPaper', 'TCL 40 R',
    'TCL 30 SE', 'TCL 30 XE', 'TCL 30 V', 'TCL 30+', 'TCL 30',
    'TCL 20 SE', 'TCL 20L', 'TCL 20 Pro', 'TCL 20S',
    'TCL Stylus 5G', 'TCL NXTPAPER',
    'TCL Tab 10 Gen2', 'TCL Tab 8', 'TCL Tab 11',
  ]},

  { brand: 'Cat', deviceType: 'Celular', models: [
    'Cat S75', 'Cat S62 Pro', 'Cat S42', 'Cat S41', 'Cat S60',
    'Cat B40', 'Cat B26', 'Cat B15',
    'Cat Tablet T10', 'Cat Tablet T20',
  ]},

  { brand: 'Kyocera', deviceType: 'Celular', models: [
    'Kyocera DuraForce Ultra', 'Kyocera DuraForce Pro 3', 'Kyocera DuraForce Pro 2',
    'Kyocera Brigadier', 'Kyocera Cadence LTE',
  ]},

  { brand: 'Fairphone', deviceType: 'Celular', models: [
    'Fairphone 5', 'Fairphone 4', 'Fairphone 3+', 'Fairphone 3',
  ]},

  { brand: 'Oukitel', deviceType: 'Celular', models: [
    'Oukitel WP30 Pro', 'Oukitel WP27', 'Oukitel WP21', 'Oukitel WP19', 'Oukitel WP15',
    'Oukitel K15 Pro', 'Oukitel K12', 'Oukitel K10',
  ]},

  { brand: 'Doogee', deviceType: 'Celular', models: [
    'Doogee S200', 'Doogee S96 Pro', 'Doogee S89 Pro', 'Doogee S88 Pro',
    'Doogee V20', 'Doogee V10', 'Doogee N40 Pro', 'Doogee N30',
  ]},

  { brand: 'Ulefone', deviceType: 'Celular', models: [
    'Ulefone Armor 27 Pro', 'Ulefone Armor 25 Pro', 'Ulefone Armor 23 Pro',
    'Ulefone Armor X12 Pro', 'Ulefone Armor X11 Pro', 'Ulefone Armor X10 Pro',
  ]},

  { brand: 'Blackview', deviceType: 'Celular', models: [
    'Blackview BL8800', 'Blackview BL7200', 'Blackview BL6000', 'Blackview BL5000',
    'Blackview BV8800', 'Blackview BV8200', 'Blackview BV6600',
    'Blackview Tab 16', 'Blackview Tab 15', 'Blackview Tab 12',
  ]},

  { brand: 'Noblex', deviceType: 'Celular', models: [
    'Noblex N50', 'Noblex N45', 'Noblex N40', 'Noblex N35', 'Noblex N30',
    'Noblex TV', 'Noblex Smart TV',
  ]},

  { brand: 'Claro', deviceType: 'Celular', models: [
    'Claro X5', 'Claro T5', 'Claro S5', 'Claro R5',
  ]},

  { brand: 'Tigo', deviceType: 'Celular', models: [
    'Tigo X1', 'Tigo Z1', 'Tigo Y1',
  ]},

  { brand: 'Multilaser', deviceType: 'Celular', models: [
    'Multilaser M11', 'Multilaser M10', 'Multilaser M9',
    'Multilaser E Pro', 'Multilaser E', 'Multilaser D Pro',
    'Multilaser Air Pro', 'Multilaser Air',
    'Multilaser G', 'Multilaser F',
  ]},

  { brand: 'Miphone', deviceType: 'Celular', models: [
    'Miphone M1', 'Miphone M2', 'Miphone M3', 'Miphone C1',
  ]},

  { brand: 'Tantan', deviceType: 'Celular', models: [
    'Tantan T1', 'Tantan T2', 'Tantan V1',
  ]},

  { brand: 'Africell', deviceType: 'Celular', models: [
    'Africell X1',
  ]},

  { brand: 'Bgh', deviceType: 'Celular', models: [
    'BGH Joy', 'BGH Smart', 'BGH Tab',
  ]},

  { brand: 'Bytech', deviceType: 'Celular', models: [
    'Bytech B-Touch', 'Bytech Smart',
  ]},

  { brand: 'Smart-tech', deviceType: 'Celular', models: [
    'Smart-Tech Pro', 'Smart-Tech Plus',
  ]},

  { brand: 'Qiale', deviceType: 'Celular', models: [
    'Qiale X1', 'Qiale C1',
  ]},

  { brand: 'Noa', deviceType: 'Celular', models: [
    'Noa H45', 'Noa H40', 'Noa H35', 'Noa H30',
    'Noa N10', 'Noa N20',
  ]},

  { brand: 'Wiko', deviceType: 'Celular', models: [
    'Wiko Y82', 'Wiko Y81', 'Wiko Y60', 'Wiko Y50', 'Wiko Y30', 'Wiko Y10',
    'Wiko T10', 'Wiko T50', 'Wiko View5', 'Wiko View4',
    'Wiko Hi Enjoy 60', 'Wiko Hi Enjoy 50',
  ]},

  { brand: 'Micronet', deviceType: 'Celular', models: [
    'Micronet SP405', 'Micronet SP350', 'Micronet SP300',
  ]},

  { brand: 'Noblex', deviceType: 'Celular', models: [] }, // ya listo arriba

  { brand: 'Samsung', deviceType: 'Celular', models: [] }, // Continuación si se necesita

  // ── Wearables (relojes, trackers) ──
  { brand: 'Samsung', deviceType: 'Celular', models: [
    'Galaxy Watch Ultra', 'Galaxy Watch 7', 'Galaxy Watch 6', 'Galaxy Watch 6 Classic',
    'Galaxy Watch 5', 'Galaxy Watch 5 Pro', 'Galaxy Watch FE', 'Galaxy Watch 4', 'Galaxy Watch 4 Classic',
    'Galaxy Watch 3', 'Galaxy Watch Active 2', 'Galaxy Watch Active', 'Galaxy Watch',
    'Galaxy Buds3 Pro', 'Galaxy Buds3', 'Galaxy Buds2 Pro', 'Galaxy Buds2', 'Galaxy Buds FE',
    'Galaxy Buds+', 'Galaxy Buds', 'Galaxy Buds Live', 'Galaxy Buds Pro',
    'Galaxy Fit 3', 'Galaxy Fit 2', 'Galaxy Fit', 'Galaxy Fit e',
    'Galaxy Ring',
  ]},

  // ── Audífonos / otros ──
  { brand: 'JBL', deviceType: 'Celular', models: [
    'JBL Tune 770NC', 'JBL Tune 720BT', 'JBL Tune 670NC', 'JBL Tune 520BT',
    'JBL Live 770NC', 'JBL Live 670NC',
    'JBL Flip 6', 'JBL Flip 5', 'JBL Flip 4',
    'JBL Charge 5', 'JBL Charge 4', 'JBL Charge 3',
    'JBL Go 3', 'JBL Go 2',
    'JBL Live Pro 2', 'JBL Live Free 2',
    'JBL Wave Beam', 'JBL Wave Flex', 'JBL Wave 200TWS',
  ]},

  { brand: 'Jabra', deviceType: 'Celular', models: [
    'Jabra Elite 10', 'Jabra Elite 85t', 'Jabra Elite 75t', 'Jabra Elite 7 Pro',
    'Jabra Elite 4', 'Jabra Elite 3',
    'Jabra Evolve2', 'Jabra Talk',
  ]},

  { brand: 'Anker', deviceType: 'Celular', models: [
    'Anker Soundcore Liberty 4', 'Anker Soundcore Liberty 3 Pro',
    'Anker Soundcore Life P3', 'Anker Soundcore Life P2',
    'Anker Soundcore Spirit', 'Anker Soundcore Trance',
    'Anker Soundcore Motion+', 'Anker Soundcore Flare',
  ]},

  // ── Smart TVs ──
  { brand: 'Samsung', deviceType: 'Smart TV', models: [
    'LED 43AU7700', 'LED 50AU7700', 'LED 55AU7700', 'LED 65AU7700', 'LED 75AU7700',
    'QLED 55QN85C', 'QLED 65QN85C', 'QLED 75QN85C', 'QLED 55QN900C',
    'OLED 55S95D', 'OLED 65S95D', 'OLED 77S95D',
    'The Frame 55"', 'The Frame 65"', 'The Frame 75"',
    'Crystal UHD 43"', 'Crystal UHD 50"', 'Crystal UHD 55"', 'Crystal UHD 65"',
  ]},

  { brand: 'LG', deviceType: 'Smart TV', models: [
    'LED 43UR7300', 'LED 50UR7300', 'LED 55UR7300', 'LED 65UR7300',
    'QNED 55"', 'QNED 65"', 'QNED 75"',
    'NanoCell 55NANO77', 'NanoCell 65NANO77',
    'OLED 55C4', 'OLED 65C4', 'OLED 77C4',
    'OLED 55B4', 'OLED 65B4',
    'OLED 55G4', 'OLED 65G4', 'OLED 77G4',
  ]},

  { brand: 'Noblex', deviceType: 'Smart TV', models: [
    'LED 43N5000', 'LED 50N5000', 'LED 55N5000', 'LED 65N5000',
    'Smart TV 43"', 'Smart TV 50"', 'Smart TV 55"', 'Smart TV 65"',
    'UHD 50"', 'UHD 55"', 'UHD 65"',
  ]},

  { brand: 'TCL', deviceType: 'Smart TV', models: [
    'LED 43P635', 'LED 50P635', 'LED 55P635', 'LED 65P635',
    'QLED 55C645', 'QLED 65C645', 'QLED 75C645',
    'Mini LED 55QM8', 'Mini LED 65QM8', 'Mini LED 75QM8',
    '4K UHD 50"', '4K UHD 55"', '4K UHD 65"',
  ]},

  { brand: 'Hisense', deviceType: 'Smart TV', models: [
    'LED 43A6500', 'LED 50A6500', 'LED 55A6500', 'LED 65A6500',
    'QLED 55U7H', 'QLED 65U7H', 'QLED 75U7H',
    'ULED 55U8H', 'ULED 65U8H',
    'Laser TV 100L5H', 'Laser TV 120L5H',
  ]},

  { brand: 'Bgh', deviceType: 'Smart TV', models: [
    'LED 43J5000', 'LED 50J5000', 'LED 55J5000',
    'Smart TV 43"', 'Smart TV 50"', 'Smart TV 55"',
    'UHD 50"', 'UHD 55"',
  ]},

  { brand: 'Philips', deviceType: 'Smart TV', models: [
    'LED 43PUS8000', 'LED 50PUS8000', 'LED 55PUS8000', 'LED 65PUS8000',
    'OLED 55OLED807', 'OLED 65OLED807',
    'Ambilight 55"', 'Ambilight 65"',
  ]},

  { brand: 'Sony', deviceType: 'Smart TV', models: [
    'LED 43X77L', 'LED 50X77L', 'LED 55X77L', 'LED 65X77L', 'LED 75X77L',
    'OLED 55A80L', 'OLED 65A80L', 'OLED 77A80L',
    'OLED 55BRAVIA 7', 'OLED 65BRAVIA 7', 'OLED 75BRAVIA 7',
    'QLED 55X90L', 'QLED 65X90L',
  ]},

  // ── Notebooks / PCs ──
  { brand: 'Dell', deviceType: 'Notebook / PC', models: [
    'Inspiron 15 3000', 'Inspiron 14 5000', 'Inspiron 16 5000', 'Inspiron 13 7000',
    'XPS 13', 'XPS 15', 'XPS 17', 'XPS 13 Plus',
    'Latitude 5540', 'Latitude 5440', 'Latitude 7440', 'Latitude 7490',
    'Vostro 3510', 'Vostro 3400',
    'G15', 'G16',
    'Alienware m16', 'Alienware m18', 'Alienware x16',
    'Precision 5680', 'Precision 7780',
  ]},

  { brand: 'HP', deviceType: 'Notebook / PC', models: [
    'Pavilion 15', 'Pavilion 14', 'Pavilion 16', 'Pavilion x360',
    'Spectre x360 14', 'Spectre x360 16', 'Spectre 13',
    'Envy x360 15', 'Envy x360 13', 'Envy 16',
    'ProBook 450 G10', 'ProBook 440 G10', 'ProBook 650 G9',
    'EliteBook 840 G10', 'EliteBook 850 G10', 'EliteBook x360',
    'Victus 16', 'Victus 15',
    'Omen 16', 'Omen 17',
    'ZBook Studio', 'ZBook Fury',
  ]},

  { brand: 'Acer', deviceType: 'Notebook / PC', models: [
    'Aspire 5', 'Aspire 3', 'Aspire 7', 'Aspire V15',
    'Nitro 5', 'Nitro V 15', 'Nitro V 16',
    'Swift 3', 'Swift 5', 'Swift Go 14', 'Swift Go 16',
    'Predator Helios 16', 'Predator Helios 18', 'Predator Helios Neo',
    'Predator Triton',
    'Chromebook 314', 'Chromebook 315',
    'TravelMate P4', 'TravelMate X3',
  ]},

  { brand: 'Lenovo', deviceType: 'Notebook / PC', models: [
    'IdeaPad 3 15', 'IdeaPad 5 14', 'IdeaPad Slim 3', 'IdeaPad Slim 5',
    'IdeaPad Gaming 3', 'IdeaPad Flex 5',
    'ThinkPad X1 Carbon Gen 11', 'ThinkPad X1 Yoga Gen 8', 'ThinkPad X13 Gen 4',
    'ThinkPad T14 Gen 4', 'ThinkPad T15 Gen 3', 'ThinkPad E14 Gen 5', 'ThinkPad E15 Gen 4',
    'ThinkPad L14 Gen 4', 'ThinkPad L15 Gen 3',
    'Legion 5', 'Legion 7', 'Legion Slim 5', 'Legion Slim 7',
    'Legion Pro 5i', 'Legion Pro 7i', 'Legion 9i',
  ]},

  { brand: 'Asus', deviceType: 'Notebook / PC', models: [
    'VivoBook 14', 'VivoBook 15', 'VivoBook S14', 'VivoBook S15',
    'ZenBook 14', 'ZenBook 13', 'ZenBook Duo',
    'ROG Strix G16', 'ROG Strix G18', 'ROG Strix SCAR 16',
    'ROG Zephyrus G14', 'ROG Zephyrus G16', 'ROG Zephyrus M16',
    'ROG Flow X13', 'ROG Flow X16',
    'Transformer Pad',
  ]},

  { brand: 'Microsoft', deviceType: 'Notebook / PC', models: [
    'Surface Pro 11', 'Surface Pro 10', 'Surface Pro 9', 'Surface Pro 8',
    'Surface Laptop 7', 'Surface Laptop 6', 'Surface Laptop 5', 'Surface Laptop 4',
    'Surface Laptop Go 3', 'Surface Laptop Go 2',
    'Surface Go 4', 'Surface Go 3',
    'Surface Book 3', 'Surface Book 2',
    'Surface Studio 2',
  ]},

  // ── Consolas ──
  { brand: 'Sony PlayStation', deviceType: 'Consola', models: [
    'PS5', 'PS5 Slim', 'PS5 Pro',
    'PS4', 'PS4 Slim', 'PS4 Pro',
    'PS3', 'PS3 Slim', 'PS3 Super Slim',
    'PS2', 'PS2 Slim',
    'PS1', 'PS1 Slim',
    'PSP', 'PSP Slim', 'PSP Go',
    'PS Vita', 'PS Vita Slim',
    'PlayStation Portal',
  ]},

  { brand: 'Microsoft Xbox', deviceType: 'Consola', models: [
    'Xbox Series X', 'Xbox Series S',
    'Xbox One X', 'Xbox One S', 'Xbox One',
    'Xbox 360 E', 'Xbox 360 S', 'Xbox 360',
    'Xbox', 'Xbox 360 Arcade',
    'Xbox Elite Controller',
  ]},

  { brand: 'Nintendo', deviceType: 'Consola', models: [
    'Switch OLED', 'Switch', 'Switch Lite',
    'Switch 2',
    '3DS XL', '3DS', '2DS XL', '2DS',
    'DSi XL', 'DSi', 'DS Lite', 'DS',
    'Wii U', 'Wii',
    'Game Boy Advance SP', 'Game Boy Advance', 'Game Boy Color', 'Game Boy',
  ]},

  // ── Impresoras ──
  { brand: 'HP', deviceType: 'Impresora', models: [
    'LaserJet Pro M404', 'LaserJet Pro M428', 'LaserJet Pro MFP M428',
    'LaserJet Pro MFP M232dwc', 'LaserJet Pro MFP M15w',
    'LaserJet 107a', 'LaserJet 108a',
    'Color LaserJet Pro MFP M283fdw', 'Color LaserJet Pro M255dw',
    'DeskJet 2710', 'DeskJet 2720', 'DeskJet 2755', 'DeskJet 3755',
    'DeskJet Ink Advantage 4155', 'DeskJet Ink Advantage 4175',
    'OfficeJet 8015', 'OfficeJet Pro 9015', 'OfficeJet Pro 9018',
    'Smart Tank 515', 'Smart Tank 525', 'Smart Tank 580', 'Smart Tank 585',
    'Envoy 4155', 'Envoy 4158',
  ]},

  { brand: 'Epson', deviceType: 'Impresora', models: [
    'L3150', 'L3110', 'L3100', 'L3250', 'L3253', 'L3260',
    'L5290', 'L6270', 'L6290',
    'WF-2830', 'WF-2850', 'WF-2960', 'WF-3820', 'WF-4830',
    'Expression Home XP-2100', 'Expression Home XP-2200', 'Expression Home XP-3100',
    'EcoTank L3150', 'EcoTank L3250', 'EcoTank L5290',
    'WorkForce Pro WF-4830', 'WorkForce Pro WF-3820',
  ]},

  { brand: 'Canon', deviceType: 'Impresora', models: [
    'PIXMA G3110', 'PIXMA G3111', 'PIXMA G3410', 'PIXMA G3411', 'PIXMA G3420',
    'PIXMA G4110', 'PIXMA G4210',
    'PIXMA TS3310', 'PIXMA TS3315', 'PIXMA TS3320', 'PIXMA TS3322',
    'PIXMA TS3410', 'PIXMA TS3420', 'PIXMA TS3510', 'PIXMA TS3520',
    'PIXMA TR4510', 'PIXMA TR4520', 'PIXMA TR4720',
    'PIXMA E4570', 'PIXMA E4770',
    'SELPHY CP1500',
  ]},

  { brand: 'Brother', deviceType: 'Impresora', models: [
    'HL-L2350DW', 'HL-L2370DW', 'HL-L2375DW', 'HL-L2310D',
    'DCP-L2530DW', 'DCP-L2540DW', 'DCP-L2550DW', 'DCP-L2510D',
    'MFC-L2710DW', 'MFC-L2730DW', 'MFC-L2750DW', 'MFC-L2752DW',
    'DCP-T420W', 'DCP-T425W', 'DCP-T426W', 'DCP-T427W',
    'DCP-T520W', 'DCP-T525W', 'DCP-T720DW', 'DCP-T725DW',
    'MFC-J1205W', 'MFC-J1215W', 'MFC-J4335DW', 'MFC-J4345DW',
  ]},

]

export function buildSeed() {
  const hash = (p) => bcrypt.hashSync(p, 10)

  const db = {
    users: [],
    customers: [],
    orders: [],
    auditLogs: [],
    catalog: { brands: [], models: [] },
    orderCounter: 0,
    config: {
      revisionFee: 5000,
      whatsapp: {
        instanceId: '',
        apiToken: '',
        local: 'El Gringo Celulares',
        messageTemplate: 'Hola {cliente}, tu {dispositivo} (Orden {orden}) quedó listo para retirar en {local}.',
      },
    },
  }

  const admin = { id: uid(), name: 'Administrador', email: 'admin@local.com', password: hash('admin123'), role: 'admin', active: true }
  db.users.push(admin)

  // Carga el catálogo completo de marcas y modelos
  for (const entry of CATALOG) {
    if (!db.catalog.brands.find((x) => x.name.toLowerCase() === entry.brand.toLowerCase())) {
      db.catalog.brands.push({ id: uid(), name: entry.brand, usage: 0 })
    }
    for (const name of entry.models) {
      if (!name) continue
      if (!db.catalog.models.find((x) => x.brand.toLowerCase() === entry.brand.toLowerCase() && x.name.toLowerCase() === name.toLowerCase())) {
        db.catalog.models.push({ id: uid(), brand: entry.brand, name, usage: 0, deviceType: entry.deviceType || 'Sin categorizar' })
      }
    }
  }

  db.auditLogs.push(
    { id: uid(), userId: admin.id, action: 'seed', table: 'db', recordId: null, details: 'Inicialización del sistema de servicio técnico', timestamp: new Date().toISOString() },
  )

  return db
}

// Si la base está vacía, crea el admin, el catálogo y las listas por defecto.
export async function seedIfEmpty() {
  const userCount = await prisma.user.count()
  if (userCount > 0) return

  const hash = (p) => bcrypt.hashSync(p, 10)
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@local.com',
      password: hash('admin123'),
      role: 'admin',
      active: true,
    },
  })

  // Plugins y tablas base antes de insertar marcas/modelos.
  await prisma.catalogBrand.createMany({
    data: CATALOG
      .map((e) => e.brand)
      .filter((v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
      .map((name) => ({ name })),
    skipDuplicates: true,
  })

  const seen = new Set()
  const models = []
  for (const entry of CATALOG) {
    for (const name of entry.models) {
      if (!name) continue
      const key = `${entry.brand.toLowerCase()}::${name.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      models.push({ brand: entry.brand, name, deviceType: entry.deviceType || 'Sin categorizar' })
    }
  }
  await prisma.catalogModel.createMany({
    data: models,
    skipDuplicates: true,
  })

  await prisma.catalogAccessory.createMany({
    data: DEFAULT_LISTS.accessories.map((name) => ({ name })),
    skipDuplicates: true,
  })
  await prisma.catalogCondition.createMany({
    data: DEFAULT_LISTS.conditions.map((name) => ({ name })),
    skipDuplicates: true,
  })
  await prisma.catalogFix.createMany({
    data: DEFAULT_LISTS.fixes.map((name) => ({ name })),
    skipDuplicates: true,
  })

  await prisma.config.upsert({
    where: { key: 'main' },
    update: {},
    create: {
      key: 'main',
      value: {
        revisionFee: 5000,
        whatsapp: {
          instanceId: '',
          apiToken: '',
          local: 'El Gringo Celulares',
          messageTemplate: 'Hola {cliente}, tu {dispositivo} (Orden {orden}) quedó listo para retirar en {local}.',
        },
        terms: DEFAULT_LISTS.terms,
      },
    },
  })

  await prisma.orderCounter.upsert({
    where: { key: 'order' },
    update: {},
    create: { key: 'order', value: 0 },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'seed',
      table: 'db',
      recordId: null,
      details: 'Inicialización del sistema de servicio técnico',
      timestamp: new Date(),
    },
  })
}
