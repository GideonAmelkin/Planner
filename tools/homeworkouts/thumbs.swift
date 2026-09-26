// Thumbnails for the Home Workouts exercise clips the app never opened.
// Usage: thumbs <out_dir> <clip.mp4>...   writes <out_dir>/<clip stem>.jpg (189px on the
// long side, frame at a quarter of the duration) and skips stems that already have one.
// Built by sync.py with swiftc into STATE_DIR/bin/thumbs; AVFoundation only, no ffmpeg.
import AVFoundation
import AppKit
import CoreImage

let args = CommandLine.arguments
if args.count < 3 {
  FileHandle.standardError.write("usage: thumbs <out_dir> <clip.mp4>...\n".data(using: .utf8)!)
  exit(64)
}
let outDir = args[1]
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
var made = 0, present = 0, failed = 0
for path in args.dropFirst(2) {
  let stem = (path as NSString).lastPathComponent.replacingOccurrences(of: ".mp4", with: "")
  let out = (outDir as NSString).appendingPathComponent(stem + ".jpg")
  if FileManager.default.fileExists(atPath: out) { present += 1; continue }
  let asset = AVURLAsset(url: URL(fileURLWithPath: path))
  let gen = AVAssetImageGenerator(asset: asset)
  gen.appliesPreferredTrackTransform = true
  gen.maximumSize = CGSize(width: 189, height: 189)
  gen.requestedTimeToleranceBefore = .zero
  gen.requestedTimeToleranceAfter = CMTime(seconds: 0.5, preferredTimescale: 600)
  let seconds = max(0.1, CMTimeGetSeconds(asset.duration) * 0.25)
  // A quarter in with a tight tolerance first; some CDN-rebuilt clips only decode from a
  // keyframe, so fall back to whatever frame the decoder can give near the start.
  // Last resort: decode sequentially with AVAssetReader (no seeking) and keep the frame
  // nearest the target time; some clips have no usable sync-sample table for the generator.
  func readSequentially() throws -> CGImage {
    guard let track = asset.tracks(withMediaType: .video).first else { throw NSError(domain: "thumbs", code: 1) }
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    output.alwaysCopiesSampleData = false
    reader.add(output)
    guard reader.startReading() else { throw reader.error ?? NSError(domain: "thumbs", code: 2) }
    var last: CGImage? = nil
    while let sample = output.copyNextSampleBuffer() {
      guard let pb = CMSampleBufferGetImageBuffer(sample) else { continue }
      let ci = CIImage(cvPixelBuffer: pb)
      let scale = 189.0 / max(ci.extent.width, ci.extent.height)
      let scaled = ci.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
      if let cg = CIContext().createCGImage(scaled, from: scaled.extent) { last = cg }
      if CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sample)) >= seconds { break }
    }
    reader.cancelReading()
    guard let cg = last else { throw NSError(domain: "thumbs", code: 3, userInfo: [NSLocalizedDescriptionKey: "no frames decoded"]) }
    return cg
  }
  func grab() throws -> CGImage {
    do {
      return try gen.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: nil)
    } catch {
      gen.requestedTimeToleranceBefore = .positiveInfinity
      gen.requestedTimeToleranceAfter = .positiveInfinity
      do { return try gen.copyCGImage(at: CMTime(seconds: 0, preferredTimescale: 600), actualTime: nil) }
      catch { return try readSequentially() }
    }
  }
  do {
    let cg = try grab()
    let rep = NSBitmapImageRep(cgImage: cg)
    guard let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85]) else {
      print("failed \(stem): jpeg encode"); failed += 1; continue
    }
    try data.write(to: URL(fileURLWithPath: out), options: .atomic)
    made += 1
  } catch {
    print("failed \(stem): \(error.localizedDescription)"); failed += 1
  }
}
print("thumbnails: \(made) made, \(present) present, \(failed) failed")
