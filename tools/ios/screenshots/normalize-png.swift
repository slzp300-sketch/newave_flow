import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Keep every visible pixel and the native dimensions. Reject transparent captures;
// the only conversion is lossless removal of a fully opaque alpha channel.
guard CommandLine.arguments.count == 3,
      let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
      let color = CGColorSpace(name: CGColorSpace.sRGB),
      let rgba = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
          bytesPerRow: image.width * 4, space: color,
          bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue),
      let rgb = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
          bytesPerRow: image.width * 4, space: color,
          bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.noneSkipLast.rawValue) else {
    fatalError("Cannot decode the original native screenshot")
}
let rectangle = CGRect(x: 0, y: 0, width: CGFloat(image.width), height: CGFloat(image.height))
rgba.draw(image, in: rectangle)
let bytes = rgba.data!.assumingMemoryBound(to: UInt8.self)
for index in stride(from: 3, to: image.width * image.height * 4, by: 4) {
    precondition(bytes[index] == 255, "Screenshot contains transparent pixels; refusing to conceal them")
}
rgb.draw(image, in: rectangle)
guard let opaque = rgb.makeImage(),
      let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[2]) as CFURL,
          UTType.png.identifier as CFString, 1, nil) else { fatalError("Cannot encode RGB screenshot") }
CGImageDestinationAddImage(destination, opaque, nil)
precondition(CGImageDestinationFinalize(destination), "RGB screenshot could not be saved")
print("Saved opaque RGB PNG at native \(image.width)×\(image.height) resolution")
