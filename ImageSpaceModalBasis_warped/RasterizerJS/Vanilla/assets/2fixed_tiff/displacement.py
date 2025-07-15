

def compute_w_3d(u):
    # compute 3d curl by putting 0 in 3rd dimension of u
    u_3d = np.zeros((u.shape[0], u.shape[1], 3))
    u_3d[:,:,0] = u[:,:,0]
    u_3d[:,:,1] = u[:,:,2]
    
    # for each pixel (3 channels) in u compute the curl using finite differences
    w = np.zeros((u.shape[0], u.shape[1], 3))
    
    dux_dy, dux_dx = np.gradient(u_3d[:,:,0])
    duy_dy, duy_dx = np.gradient(u_3d[:,:,1])
    duz_dy, duz_dx = np.gradient(u_3d[:,:,2])
 
   
    # compute curl of w
    w = np.zeros((u.shape[0], u.shape[1], 3))
    
    w[:,:,2] = duy_dx - dux_dy
    return w 
    
    
   
def rodrigues_rotation(w, u):
    w_len = np.linalg.norm(w)
    
    if w_len == 0:
        return u 
    
    w_hat = w / w_len
    s = np.sin(w_len)
    c = np.cos(w_len)
    c1 = (1 - c) / w_len
    c2 = 1 - (s / w_len)
    
    rotated_u = u
    rotated_u += np.cross(w_hat, u) * c1 + np.cross(w_hat, np.cross(w_hat, u)) * c2
    
    return rotated_u
    
    
def compute_w_2d(u):
    # for each pixel (2 channels) in u compute the curl using finite differences
    w = np.zeros((u.shape[0], u.shape[1], 3), dtype=np.float64)
   
    # note, u is 4 channel 
    dux_dy, dux_dx = np.gradient(u[:,:,0])
    duy_dy, duy_dx = np.gradient(u[:,:,2])
    
    # asset that u is 0 for channesl 1 and 3
    assert np.all(u[:,:,1] == 0)
    assert np.all(u[:,:,3] == 0)
    
    w[:,:,2] = (duy_dx - dux_dy) * 5.0
    
    return  w


def compute_R(w):
    H, W, _ = w.shape
    
    theta = np.linalg.norm(w, axis=2)

    norm_w = np.linalg.norm(w, axis=2, keepdims=True)
    # k = np.where(norm_w == 0, 0, w / norm_w)
    
    epsilon = 1e-10  # A small value to prevent division by zero
    norm_w_safe = np.maximum(norm_w, epsilon)  # Replace zeros with epsilon
    k = w / norm_w_safe

    s, c = np.sin(theta), np.cos(theta)

    K = np.zeros((H, W, 3, 3))
    K[:,:,0,1] = -k[:,:,2]
    K[:,:,1,0] = k[:,:,2]
    K[:,:,0,2] = k[:,:,1]
    K[:,:,2,0] = -k[:,:,1]
    K[:,:,1,2] = -k[:,:,0]
    K[:,:,2,1] = k[:,:,0]
    
    I = np.eye(3)[np.newaxis, np.newaxis, :, :]  

    R_3D = I + s[:,:,np.newaxis,np.newaxis] * K + (1 - c[:,:,np.newaxis,np.newaxis]) * np.matmul(K, K)
    
    R_xy = R_3D[:,:,:2,:2]
    
    return R_xy 


def compute_R_2D(w):
    angle = np.abs(w[:,:,2])
    sign = np.sign(w[:,:,2])
    angle *= sign
    
    s, c = np.sin(angle), np.cos(angle)
    
    R = np.zeros((w.shape[0], w.shape[1], 2, 2), dtype=np.float64)
    R[:,:,0,0] = c
    R[:,:,0,1] = -s
    R[:,:,1,0] = s
    R[:,:,1,1] = c
   
    return R 



import numpy as np
import matplotlib.pyplot as plt
from matplotlib.image import imread
import json
import tiffile as tiff

# Load the displacement map
# displacement = imrea('fixed_fixed_mode_1_displacement.png')
displacement = tiff.imread('fixed_fixed_mode_1_displacement.tiff')
# need to denormalize using ranges in .json file
with open('fixed_fixed_modes_data.json', 'r') as f:
    data = json.load(f)

print(data.keys())
real_min = data['ranges'][0]
real_max = data['ranges'][1]


# denormalize 1st channel
plt.imshow(displacement[:,:,0])
plt.show()
displacement[:,:,0] = displacement[:,:,0] * (real_max - real_min) + real_min
plt.imshow(displacement[:,:,0], cmap='RdYlGn', vmin=-1, vmax=1)
plt.show()
# displacement *= 10.0
height, width = displacement.shape[:2]

displacement *= +1
# Create 4-channel displacement field (u)
u = np.zeros((height, width, 4))
u[:,:,0] = displacement[:,:,0]  # x displacement in first channel
u[:,:,2] = np.zeros_like(displacement[:,:,0])  # y displacement in third channel
# channels 1 and 3 remain zero as per assertion requirements

from scipy.ndimage import gaussian_filter1d
# u[:,:,0] = gaussian_filter1d(u[:,:,0], sigma=5.0, axis=0)



# Compute analytic curl
n = 1 # Mode number
L = 1
H = displacement.shape[0] 
W = displacement.shape[1] 

y = np.linspace(0, L, H)

# add pi to cos to account for negative phase
w_z = -np.pi * n / L * np.cos(np.pi * n / L * y + np.pi + np.pi)

w_analytic = np.zeros((H, W, 3))
for i in range(W):
    w_analytic[:, i, 2] = w_z

w_analytic*= 0.1
# apply blurring
from scipy.ndimage import gaussian_filter
w_analytic[:,:,2] = gaussian_filter(w_analytic[:,:,2], sigma=5.0)

# apply mask rod_mask.png
mask = imread('rod_mask.png')
# apply to w_analytic
w_analytic[:,:,2] = w_analytic[:,:,2] * mask[:,:,0]

# flip vertically
# w_analytic = np.flipud(w_analytic)
w_analytic *=  1.0

# Calculate w (curl)
w = compute_w_2d(u) * 1.0

# Calculate rotation matrix (using both methods for comparison)
R_2D = compute_R_2D(w)
R_3D = compute_R(w)

R_2D_analytic = compute_R_2D(w_analytic)

# Get the middle column for the line
middle_col = width // 2

# Create coordinate arrays
y = np.arange(height)
x_original = np.ones_like(y) * middle_col

displacement *= 5.0


# Get displacements and rotations for the middle column
displacement_x = displacement[:, middle_col, 0]


rotation_matrix = R_2D[:, middle_col]
rotation_matrix_analytic = R_2D_analytic[:, middle_col]

# Scale factor for displacement
scale_factor = 5
displacement_x_scaled = displacement_x * scale_factor

# Create displacement vectors for each point
displacement_vectors = np.zeros((height, 2))
displacement_vectors[:,0] = displacement_x_scaled

# Apply rotation to displacement vectors
rotated_displacements = np.zeros_like(displacement_vectors)
rotated_displacements_analytic = np.zeros_like(displacement_vectors)
for i in range(height):
    rotated_displacements[i] = rotation_matrix[i] @ displacement_vectors[i]
    rotated_displacements_analytic[i] = rotation_matrix_analytic[i] @ displacement_vectors[i]
    
    

# Apply the rotated displacements
x_displaced = x_original + rotated_displacements[:,0]
y_displaced = y + rotated_displacements[:,1]

x_displaced_analytic = x_original + rotated_displacements_analytic[:,0]
y_displaced_analytic = y + rotated_displacements_analytic[:,1]

# Adjust the y-range to display only the middle 400 values
start_y = 100
end_y = start_y + 400

# finite differences
y_middle = y[start_y:end_y]
x_original_middle = x_original[start_y:end_y]
x_displaced_middle = x_displaced[start_y:end_y]
y_displaced_middle = y_displaced[start_y:end_y]

# analytic
x_displaced_analytic_middle = x_displaced_analytic[start_y:end_y]
y_displaced_analytic_middle = y_displaced_analytic[start_y:end_y]


# Extract the z-component of the curl
curl_z = w[start_y:end_y, :, 2]  # Only the z-component for the displayed range



curl_z_analytic = w_analytic[start_y:end_y, :, 2]
curl_z_finite_diff = curl_z



# Set up figure for combined plots
plt.figure(figsize=(12, 12))

# Set fixed colorbar range
vmin, vmax = -0.6, 0.6

# Row 1: Analytical plots

# Subplot 1: Analytic Curl Heatmap
plt.subplot(2, 2, 1)
im1 = plt.imshow(curl_z_analytic, cmap='coolwarm', aspect='auto', extent=[0, width, end_y, start_y], vmin=vmin, vmax=vmax)
plt.colorbar(im1, label='Analytic Curl (w_z)')
plt.title('Analytic Curl Heatmap (w_z Component)')
plt.xlabel('X Position')
plt.ylabel('Y Position')
plt.gca().invert_yaxis()
plt.grid(False)

# Subplot 2: Analytic Displacement Plot
plt.subplot(2, 2, 2)
plt.plot(x_original_middle, y_middle, 'k--', label='Original Line', alpha=0.5)
plt.plot(x_displaced_analytic_middle, y_displaced_analytic_middle, 'teal', linewidth=5, label='Analytic Displacement')
plt.plot(x_original_middle + displacement_x_scaled[start_y:end_y], y_middle, 'r--', linewidth=2, label='Non-rotated Displacement')
plt.xlabel('X Position')
plt.ylabel('Y Position')
plt.title('Analytic Displacement Plot')
plt.legend()
plt.gca().invert_yaxis()
plt.axis('equal')
plt.grid(True, alpha=0.3)

# Row 2: Finite difference plots

# Subplot 3: Finite Difference Curl Heatmap
plt.subplot(2, 2, 3)
im2 = plt.imshow(curl_z_finite_diff, cmap='coolwarm', aspect='auto', extent=[0, width, end_y, start_y], vmin=vmin, vmax=vmax)
plt.colorbar(im2, label='Finite Diff Curl (w_z)')
plt.title('Finite Difference Curl Heatmap (w_z Component)')
plt.xlabel('X Position')
plt.ylabel('Y Position')
plt.gca().invert_yaxis()
plt.grid(False)

# Subplot 4: Finite Difference Displacement Plot
plt.subplot(2, 2, 4)
plt.plot(x_original_middle, y_middle, 'k--', label='Original Line', alpha=0.5)
plt.plot(x_displaced_middle, y_displaced_middle, 'teal', linewidth=5, label='Finite Differences')
plt.plot(x_original_middle + displacement_x_scaled[start_y:end_y], y_middle, 'r--', linewidth=2, label='Non-rotated Displacement')
plt.xlabel('X Position')
plt.ylabel('Y Position')
plt.title('Finite Difference Displacement Plot')
plt.legend()
plt.gca().invert_yaxis()
plt.axis('equal')
plt.grid(True, alpha=0.3)

# Adjust layout to fit all subplots nicely
plt.tight_layout()

# Show the combined figure
plt.show()

# # Row 1: Analytical plots

# # Subplot 1: Analytic Curl Heatmap
# plt.subplot(2, 2, 1)
# im1 = plt.imshow(curl_z_analytic, cmap='coolwarm', aspect='auto', extent=[0, width, end_y, start_y], vmin=vmin, vmax=vmax)
# plt.colorbar(im1, label='Analytic Curl (w_z)')
# plt.title('Analytic Curl Heatmap (w_z Component)')
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.gca().invert_yaxis()
# plt.grid(False)

# # Subplot 2: Analytic Displacement Plot
# plt.subplot(2, 2, 2)
# plt.plot(x_displaced_analytic_middle, y_displaced_analytic_middle, 'teal', linewidth=5, label='Analytic Displacement')
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Analytic Displacement Plot')
# plt.legend()
# plt.gca().invert_yaxis()
# plt.axis('equal')
# plt.grid(True, alpha=0.3)

# # Row 2: Finite difference plots

# # Subplot 3: Finite Difference Curl Heatmap
# plt.subplot(2, 2, 3)
# im2 = plt.imshow(curl_z_finite_diff, cmap='coolwarm', aspect='auto', extent=[0, width, end_y, start_y], vmin=vmin, vmax=vmax)
# plt.colorbar(im2, label='Finite Diff Curl (w_z)')
# plt.title('Finite Difference Curl Heatmap (w_z Component)')
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.gca().invert_yaxis()
# plt.grid(False)

# # Subplot 4: Finite Difference Displacement Plot
# plt.subplot(2, 2, 4)
# plt.plot(x_displaced_middle, y_displaced_middle, 'teal', linewidth=5, label='Finite Differences')
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Finite Difference Displacement Plot')
# plt.legend()
# plt.gca().invert_yaxis()
# plt.axis('equal')
# plt.grid(True, alpha=0.3)

# # Adjust layout to fit all subplots nicely
# plt.tight_layout()

# # Show the combined figure
# plt.show()


# # Plot the curl heatmap
# plt.figure(figsize=(12, 6))
# plt.imshow(curl_z, cmap='coolwarm', aspect='auto', extent=[0, width, end_y, start_y])
# plt.colorbar(label='Curl (w_z)')
# plt.title('Curl Heatmap (w_z Component)')
# plt.xlabel('X Position')
# plt.ylabel('Y Position')

# # Make y-axis go from top to bottom to match image coordinates
# plt.gca().invert_yaxis()

# plt.grid(False)  # Optional: Turn off grid for better heatmap visualization
# plt.show()





# # Plotting
# plt.figure(figsize=(12, 6))

# # Plot original line
# plt.plot(x_original_middle, y_middle, 'b--', label='Original Line', alpha=0.5)

# # Plot displaced and rotated line (finite differences)
# plt.plot(x_displaced_middle, y_displaced_middle, 'r-', label='Finite Differences', linewidth=5)

# # Plot displaced and rotated line (analytic)
# plt.plot(x_displaced_analytic_middle, y_displaced_analytic_middle, 'g-', label='Analytic', linewidth=5)

# # Add labels and title
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Line with Displacement and Rotation Applied (Finite Differences vs. Analytic)')
# plt.legend()

# # Make y axis go from top to bottom to match image coordinates
# plt.gca().invert_yaxis()

# # Set reasonable x limits
# padding = scale_factor * 1.2
# plt.xlim(middle_col - padding, middle_col + padding)

# # Set aspect ratio to equal for true shape
# plt.axis('equal')

# plt.grid(True, alpha=0.3)
# plt.show()

# # Optional: Save the profile data
# np.savetxt('displacement_rotation_profile.txt',
#            np.column_stack([y_middle, x_displaced_middle, y_displaced_middle, x_displaced_analytic_middle, y_displaced_analytic_middle]))

# # Print debug info
# print("Max rotation angle (degrees):", np.max(np.abs(np.rad2deg(w[start_y:end_y, middle_col, 2]))))
# print("Max displacement:", np.max(np.abs(displacement_x_scaled[start_y:end_y])))
# print("Max rotated displacement (finite differences):", np.max(np.abs(rotated_displacements[start_y:end_y])))
# print("Max rotated displacement (analytic):", np.max(np.abs(rotated_displacements_analytic[start_y:end_y])))


# curl_z_analytic = w_analytic[start_y:end_y, :, 2]
# curl_z_finite_diff = curl_z
# # Set up figure for combined plots
# plt.figure(figsize=(12, 12))

# # Row 1: Analytical plots

# # Subplot 1: Analytic Curl Heatmap
# plt.subplot(2, 2, 1)
# plt.imshow(curl_z_analytic, cmap='coolwarm', aspect='auto', extent=[0, width, end_y, start_y])
# plt.colorbar(label='Analytic Curl (w_z)')
# plt.title('Analytic Curl Heatmap (w_z Component)')
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.gca().invert_yaxis()
# plt.grid(False)

# # Subplot 2: Analytic Displacement Plot
# plt.subplot(2, 2, 2)
# plt.plot(x_displaced_analytic_middle, y_displaced_analytic_middle, 'teal', linewidth=5, label='Analytic Displacement')
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Analytic Displacement Plot')
# plt.legend()
# plt.gca().invert_yaxis()
# plt.axis('equal')
# plt.grid(True, alpha=0.3)

# # Row 2: Finite difference plots

# # Subplot 3: Finite Difference Curl Heatmap
# plt.subplot(2, 2, 3)
# plt.imshow(curl_z_finite_diff, cmap='coolwarm', aspect='auto', extent=[0, width, end_y, start_y])
# plt.colorbar(label='Finite Diff Curl (w_z)')
# plt.title('Finite Difference Curl Heatmap (w_z Component)')
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.gca().invert_yaxis()
# plt.grid(False)

# # Subplot 4: Finite Difference Displacement Plot
# plt.subplot(2, 2, 4)
# plt.plot(x_displaced_middle, y_displaced_middle, 'teal', linewidth=5, label='Finite Differences')
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Finite Difference Displacement Plot')
# plt.legend()
# plt.gca().invert_yaxis()
# plt.axis('equal')
# plt.grid(True, alpha=0.3)

# # Adjust layout to fit all subplots nicely
# plt.tight_layout()

# # Show the combined figure
# plt.show()


# Plotting
# TODO add plotting for analytics
# plt.figure(figsize=(12, 6))

# # Plot original line
# plt.plot(x_original_middle, y_middle, 'b--', label='Original Line', alpha=0.5)

# # Plot displaced and rotated line
# plt.plot(x_displaced_middle, y_displaced_middle, 'r-', label='Displaced & Rotated Line', linewidth=5)

# # Add labels and title
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Line with Displacement and Rotation Applied')
# plt.legend()

# # Make y axis go from top to bottom to match image coordinates
# plt.gca().invert_yaxis()

# # Set reasonable x limits
# padding = scale_factor * 1.2
# plt.xlim(middle_col - padding, middle_col + padding)

# # Set aspect ratio to equal for true shape
# plt.axis('equal')

# plt.grid(True, alpha=0.3)
# plt.show()

# # Optional: Save the profile data
# np.savetxt('displacement_rotation_profile.txt',
#            np.column_stack([y_middle, x_displaced_middle, y_displaced_middle]))

# # Print some debug info
# print("Max rotation angle (degrees):", np.max(np.abs(np.rad2deg(w[start_y:end_y, middle_col, 2]))))
# print("Max displacement:", np.max(np.abs(displacement_x_scaled[start_y:end_y])))
# print("Max rotated displacement:", np.max(np.abs(rotated_displacements[start_y:end_y])))












# import numpy as np
# import matplotlib.pyplot as plt
# from matplotlib.image import imread




# import numpy as np
# import matplotlib.pyplot as plt
# from matplotlib.image import imread

# # Load the displacement map
# displacement = imread('fixed_fixed_mode_3_displacement.png')
# height, width = displacement.shape[:2]
# middle_col = width // 2
# y = np.arange(height)
# x_original = np.ones_like(y) * middle_col

# # Create 4-channel displacement field (u)
# u = np.zeros((height, width, 4))
# u[:,:,0] = displacement[:,:,0]
# u[:,:,2] = np.zeros_like(displacement[:,:,0])

# # 1. Pure displacement
# displacement_profile = displacement[:, middle_col, 0]
# scale_factor = 200
# x_displaced_pure = x_original + displacement_profile * scale_factor
# y_displaced_pure = y

# # 2. Rodriguez rotation following your previous approach
# w = compute_w_2d(u * 10)  # Scale the input to compute_w_2d as in your example
# displacement_x = displacement[:, middle_col, 0] * scale_factor
# displacement_y = np.zeros_like(displacement_x)

# rotated_U = np.zeros_like(displacement_x)
# rotated_V = np.zeros_like(displacement_x)

# # Apply Rodriguez rotation to each point along the line
# for i in range(len(y)):
#     # Create 3D vector by adding zero Z component
#     vector = np.array([displacement_x[i], displacement_y[i], 0])
#     # Get rotation vector at this point
#     w_i = w[i, middle_col]
#     # Apply Rodriguez rotation
#     rotated_vector = rodrigues_rotation(w_i, vector)
#     # Store X and Y components of rotated vector
#     rotated_U[i] = rotated_vector[0]
#     rotated_V[i] = rotated_vector[1]

# x_displaced_rod = x_original + rotated_U
# y_displaced_rod = y + rotated_V

# # Plotting
# plt.figure(figsize=(12, 6))

# # Plot original line
# plt.plot(x_original, y, 'k--', label='Original Line', alpha=0.5)

# # Plot both versions
# plt.plot(x_displaced_pure, y_displaced_pure, 'b-', label='Pure Displacement', linewidth=2)
# plt.plot(x_displaced_rod, y_displaced_rod, 'g-', label='Rodrigues Rotation', linewidth=2)

# # Add labels and title
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Comparison of Pure Displacement vs Rodriguez Rotation')
# plt.legend()

# # Make y axis go from top to bottom to match image coordinates
# plt.gca().invert_yaxis()

# # Set reasonable x limits
# padding = scale_factor * 1.2
# plt.xlim(middle_col - padding, middle_col + padding)

# # Set aspect ratio to equal for true shape
# plt.axis('equal')

# plt.grid(True, alpha=0.3)
# plt.show()

# # Print debug info
# print("\nMaximum displacements:")
# print(f"Pure displacement: {np.max(np.abs(x_displaced_pure - x_original)):.2f}")
# print(f"Rodrigues: {np.max(np.abs(np.sqrt((x_displaced_rod - x_original)**2 + (y_displaced_rod - y)**2))):.2f}")

# # Optionally, also show the vector field around the middle column
# plt.figure(figsize=(10, 8))
# sample_width = 20  # Number of columns to show on each side of the middle
# sample_step = 10   # Show every Nth point for clarity

# # Create sample grid around the middle column
# y_sample = np.arange(0, height, sample_step)
# x_sample = np.arange(middle_col - sample_width, middle_col + sample_width + 1)
# X, Y = np.meshgrid(x_sample, y_sample)

# # Calculate vectors for the sampled points
# U = np.zeros_like(X, dtype=float)
# V = np.zeros_like(X, dtype=float)

# for i, y_idx in enumerate(y_sample):
#     for j, x_idx in enumerate(x_sample):
#         vector = np.array([displacement[y_idx, x_idx, 0] * scale_factor, 0, 0])
#         rotated_vector = rodrigues_rotation(w[y_idx, x_idx], vector)
#         U[i, j] = rotated_vector[0]
#         V[i, j] = rotated_vector[1]

# plt.quiver(X, Y, U, V, color='teal', angles='xy', scale_units='xy', scale=1)
# plt.scatter(X, Y, color='gray', s=1)
# plt.plot(x_displaced_rod, y_displaced_rod, 'r-', linewidth=2, label='Displaced Line')
# plt.gca().invert_yaxis()
# plt.axis('equal')
# plt.title('Vector Field Around Displaced Line')
# plt.show()

# # # Load the displacement map
# displacement = imread('fixed_fixed_mode_3_displacement.png')
# height, width = displacement.shape[:2]
# middle_col = width // 2
# y = np.arange(height)
# x_original = np.ones_like(y) * middle_col

# # 1. Pure displacement
# displacement_profile = displacement[:, middle_col, 0]
# scale_factor = 200
# x_displaced_pure = x_original + displacement_profile * scale_factor
# y_displaced_pure = y

# # 2. Rotation matrix displacement
# u = np.zeros((height, width, 4))
# u[:,:,0] = displacement[:,:,0]
# u[:,:,2] = np.zeros_like(displacement[:,:,0])

# w = compute_w_2d(u) * 10.0
# R_2D = compute_R_2D(w)

# displacement_vectors_rot = np.zeros((height, 2))
# displacement_vectors_rot[:,0] = displacement_profile * scale_factor

# rotated_displacements = np.zeros_like(displacement_vectors_rot)
# for i in range(height):
#     rotated_displacements[i] = R_2D[i, middle_col] @ displacement_vectors_rot[i]

# x_displaced_rot = x_original + rotated_displacements[:,0]
# y_displaced_rot = y + rotated_displacements[:,1]

# # 3. Rodrigues rotation
# w = compute_w_3d(displacement)
# w_middle = w[:, middle_col]

# displacement_vectors_rod = np.zeros((height, 3))
# displacement_vectors_rod[:,0] = displacement_profile * scale_factor

# rotated_displacements_rod = np.zeros_like(displacement_vectors_rod)
# for i in range(height):
#     rotated_displacements_rod[i] = rodrigues_rotation(w_middle[i], displacement_vectors_rod[i])

# x_displaced_rod = x_original + rotated_displacements_rod[:,0]
# y_displaced_rod = y + rotated_displacements_rod[:,1]

# # Plotting
# plt.figure(figsize=(12, 6))

# # Plot original line
# plt.plot(x_original, y, 'k--', label='Original Line', alpha=0.5)

# # Plot all three displacement versions
# plt.plot(x_displaced_pure, y_displaced_pure, 'b-', label='Pure Displacement', linewidth=5)
# plt.plot(x_displaced_rot, y_displaced_rot, 'r-', label='Rotation Matrix', linewidth=2)
# plt.plot(x_displaced_rod, y_displaced_rod, 'g-', label='Rodrigues Rotation', linewidth=2)

# # Add labels and title
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Comparison of Different Displacement Methods')
# plt.legend()

# # Make y axis go from top to bottom to match image coordinates
# plt.gca().invert_yaxis()

# # Set reasonable x limits
# padding = scale_factor * 1.2
# plt.xlim(middle_col - padding, middle_col + padding)

# # Set aspect ratio to equal for true shape
# plt.axis('equal')

# plt.grid(True, alpha=0.3)
# plt.show()

# # Print debug info for comparison
# print("\nMaximum displacements:")
# print(f"Pure displacement: {np.max(np.abs(x_displaced_pure - x_original)):.2f}")
# print(f"Rotation matrix: {np.max(np.abs(np.sqrt((x_displaced_rot - x_original)**2 + (y_displaced_rot - y)**2))):.2f}")
# print(f"Rodrigues: {np.max(np.abs(np.sqrt((x_displaced_rod - x_original)**2 + (y_displaced_rod - y)**2))):.2f}")



# import numpy as np
# import matplotlib.pyplot as plt
# from matplotlib.image import imread
# from scipy.ndimage import map_coordinates


# # Load the images
# rod = imread('rod.png')
# displacement = imread('fixed_fixed_mode_3_displacement.png')

# # Get the middle column of the red channel (x displacement)
# height, width = displacement.shape[:2]
# middle_col = width // 2
# displacement_profile = displacement[:, middle_col, 0]  # Red channel

# # Create y coordinates (going from 0 to height-1)
# y = np.arange(height)

# # Create the original straight line at x = middle_col
# x_original = np.ones_like(y) * middle_col

# # Scale the displacement (adjust this factor as needed)
# scale_factor = 500
# x_displaced = x_original + displacement_profile * scale_factor

# # Plot
# plt.figure(figsize=(12, 6))

# # Plot the original and displaced lines
# plt.plot(x_original, y, 'b--', label='Original Line', alpha=0.5)
# plt.plot(x_displaced, y, 'r-', label='Displaced Line', linewidth=5)

# # Add labels and title
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Line Displacement from Middle Column of Displacement Map')
# plt.legend()

# # Make y axis go from top to bottom to match image coordinates
# plt.gca().invert_yaxis()

# # Set reasonable x limits
# padding = scale_factor * 1.2
# plt.xlim(middle_col - padding, middle_col + padding)

# # Set aspect ratio to equal for true shape
# plt.axis('equal')

# plt.grid(True, alpha=0.3)
# plt.show()

# # Optional: If you want to save the displacement profile data
# np.savetxt('displacement_profile.txt', np.column_stack([y, x_displaced]))


   



# import numpy as np
# import matplotlib.pyplot as plt
# from matplotlib.image import imread
# import json

# # Load the displacement map
# displacement = imread('fixed_fixed_mode_1_displacement.png')
# # need to denormalize using ranges in .json file
# with open('fixed_fixed_modes_data.json', 'r') as f:
#     data = json.load(f)
    
# ranges = data['ranges']
# real_min = ranges[0]
# real_max = ranges[1]

# # denormalize 1st channel
# displacement[:,:,0] = displacement[:,:,0] * (real_max - real_min) + real_min

# height, width = displacement.shape[:2]

# # Create 4-channel displacement field (u)
# u = np.zeros((height, width, 4))
# u[:,:,0] = displacement[:,:,0]  # x displacement in first channel
# u[:,:,2] = np.zeros_like(displacement[:,:,0])  # y displacement in third channel
# # channels 1 and 3 remain zero as per assertion requirements

# # Calculate w (curl)
# w = compute_w_2d(u) * 0.0 #*10.0

# # Calculate rotation matrix (using both methods for comparison)
# R_2D = compute_R_2D(w)
# R_3D = compute_R(w)

# # Get the middle column for the line
# middle_col = width // 2

# # Create coordinate arrays
# y = np.arange(height)
# x_original = np.ones_like(y) * middle_col

# # Get displacements and rotations for the middle column
# displacement_x = displacement[:, middle_col, 0]
# rotation_matrix = R_2D[:, middle_col]

# # Scale factor for displacement
# scale_factor = 1
# displacement_x_scaled = displacement_x * scale_factor

# # Create displacement vectors for each point
# displacement_vectors = np.zeros((height, 2))
# displacement_vectors[:,0] = displacement_x_scaled

# # Apply rotation to displacement vectors
# rotated_displacements = np.zeros_like(displacement_vectors)
# for i in range(height):
#     rotated_displacements[i] = rotation_matrix[i] @ displacement_vectors[i]

# # Apply the rotated displacements
# x_displaced = x_original + rotated_displacements[:,0]
# y_displaced = y + rotated_displacements[:,1]

# # Plotting
# plt.figure(figsize=(12, 6))

# # Plot original line
# plt.plot(x_original, y, 'b--', label='Original Line', alpha=0.5)

# # Plot displaced and rotated line
# plt.plot(x_displaced, y_displaced, 'r-', label='Displaced & Rotated Line', linewidth=5)

# # Add labels and title
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Line with Displacement and Rotation Applied')
# plt.legend()

# # Make y axis go from top to bottom to match image coordinates
# plt.gca().invert_yaxis()

# # Set reasonable x limits
# padding = scale_factor * 1.2
# plt.xlim(middle_col - padding, middle_col + padding)

# # Set aspect ratio to equal for true shape
# plt.axis('equal')

# plt.grid(True, alpha=0.3)
# plt.show()

# # Optional: Save the profile data
# np.savetxt('displacement_rotation_profile.txt', 
#            np.column_stack([y, x_displaced, y_displaced]))

# # Print some debug info
# print("Max rotation angle (degrees):", np.max(np.abs(np.rad2deg(w[:,:,2]))))
# print("Max displacement:", np.max(np.abs(displacement_x_scaled)))
# print("Max rotated displacement:", np.max(np.abs(rotated_displacements)))







# # Load the displacement map
# displacement = imread('fixed_fixed_mode_3_displacement.png')

# height, width = displacement.shape[:2]

# # Create 4-channel displacement field (u)
# u = np.zeros((height, width, 4))
# u[:,:,0] = displacement[:,:,0]  # x displacement in first channel
# u[:,:,2] = np.zeros_like(displacement[:,:,0])  # y displacement in third channel
# # channels 1 and 3 remain zero as per assertion requirements

# # Calculate w (curl)
# w = compute_w_2d(u)

# # Get the middle column for the line
# middle_col = width // 2

# # Create coordinate arrays
# y = np.arange(height)
# x_original = np.ones_like(y) * middle_col

# # Get displacements for the middle column
# displacement_x = displacement[:, middle_col, 0]
# w_middle = w[:, middle_col]

# # Scale factor for displacement
# scale_factor = 200
# displacement_x_scaled = displacement_x * scale_factor

# # Create displacement vectors for each point
# displacement_vectors = np.zeros((height, 3))  # Using 3D vectors for Rodrigues rotation
# displacement_vectors[:,0] = displacement_x_scaled

# # Apply Rodrigues rotation to each displacement vector
# rotated_displacements = np.zeros_like(displacement_vectors)
# for i in range(height):
#     rotated_displacements[i] = rodrigues_rotation(w_middle[i], displacement_vectors[i])

# # Apply the rotated displacements (using only x and y components)
# x_displaced = x_original + rotated_displacements[:,0]
# y_displaced = y + rotated_displacements[:,1]

# # Plotting
# plt.figure(figsize=(12, 6))

# # Plot original line
# plt.plot(x_original, y, 'b--', label='Original Line', alpha=0.5)

# # Plot displaced and rotated line
# plt.plot(x_displaced, y_displaced, 'r-', label='Displaced & Rotated Line', linewidth=5)

# # Add labels and title
# plt.xlabel('X Position')
# plt.ylabel('Y Position')
# plt.title('Line with Displacement and Rodrigues Rotation Applied')
# plt.legend()

# # Make y axis go from top to bottom to match image coordinates
# plt.gca().invert_yaxis()

# # Set reasonable x limits
# padding = scale_factor * 1.2
# plt.xlim(middle_col - padding, middle_col + padding)

# # Set aspect ratio to equal for true shape
# plt.axis('equal')

# plt.grid(True, alpha=0.3)
# plt.show()

# # Optional: Save the profile data
# np.savetxt('displacement_rodrigues_profile.txt', 
#            np.column_stack([y, x_displaced, y_displaced]))

# # Print some debug info
# print("Max rotation angle (degrees):", np.max(np.abs(np.rad2deg(w[:,:,2]))))
# print("Max displacement:", np.max(np.abs(displacement_x_scaled)))
# print("Max rotated displacement:", np.max(np.abs(rotated_displacements)))