from PIL import Image, ImageEnhance

def add_gray_black_overlay(image_path, output_path):
    # Load the RGBA image
    image = Image.open(image_path).convert("RGBA")
    
    # Create a gray-black overlay
    overlay = Image.new("RGBA", image.size, (0, 0, 0, int(0.5 * 255)))
    
    # Blend the overlay with the image
    blended = Image.alpha_composite(image, overlay)
    
    # Save the result
    blended.save(output_path, "PNG")

# Example usage

for i in range(10):
    add_gray_black_overlay(f"./assets/aug14/mode{i}_RGBA.png", f"./assets/aug14/mode{i}_RGBA_overlay.png")