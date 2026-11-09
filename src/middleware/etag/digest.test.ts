import { generateDigest } from './digest'

describe('generateDigest', () => {
  it('Should copy pending bytes from a stream that reuses its buffer', async () => {
    const scratch = new Uint8Array(4)
    let pullCount = 0
    const stream = new ReadableStream({
      pull(controller) {
        scratch.fill(pullCount === 0 ? 0x41 : 0x42)
        controller.enqueue(scratch)
        if (++pullCount === 2) {
          controller.close()
        }
      },
    })

    const digest = await generateDigest(stream, (body) => crypto.subtle.digest('SHA-1', body))

    expect(digest).toBe('7cd188ef3a9ea7fa0ee9c62c168709695460f5c0')
  })

  it('Should return null for a null stream', async () => {
    const digest = await generateDigest(null, (body) => crypto.subtle.digest('SHA-1', body))

    expect(digest).toBeNull()
  })

  it('Should digest bodies that cross the 256KB chunk boundary in odd sizes', async () => {
    const sizes = [200000, 100000, 230000]
    const full = new Uint8Array(sizes.reduce((a, b) => a + b, 0))
    for (let i = 0; i < full.byteLength; i++) {
      full[i] = i % 256
    }

    const stream = new ReadableStream({
      start(controller) {
        let offset = 0
        for (const size of sizes) {
          controller.enqueue(full.slice(offset, offset + size))
          offset += size
        }
        controller.close()
      },
    })

    const digest = await generateDigest(stream, (body) => crypto.subtle.digest('SHA-1', body))
    const expected = await crypto.subtle.digest('SHA-1', full)
    const expectedHex = Array.prototype.map
      .call(new Uint8Array(expected), (x) => x.toString(16).padStart(2, '0'))
      .join('')

    expect(digest).toBe(expectedHex)
  })
})
