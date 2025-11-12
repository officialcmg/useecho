import { PinataSDK } from 'pinata'

if (!process.env.PINATA_JWT) {
  throw new Error('PINATA_JWT is required')
}

if (!process.env.PINATA_GATEWAY) {
  throw new Error('PINATA_GATEWAY is required')
}

export const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY
})
