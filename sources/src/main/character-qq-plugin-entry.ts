import { CharacterQQChannels, type CharacterQQChannelsOptions } from './character-qq-channel'
export const abi = 1
export const id = 'qq-channel'
export const version = '1.0.0'
export function createQQChannels(options: CharacterQQChannelsOptions): CharacterQQChannels { return new CharacterQQChannels(options) }
