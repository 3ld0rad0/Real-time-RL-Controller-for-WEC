from collections import deque
import numpy as np



# Dati di esempio
data = np.array([0, 20, 30, 40, 50])

# Min e Max
x_min = data.min()
x_max = data.max()

# Normalizzazione in [-1, 1]
data_normalized = 2 * (data - x_min) / (x_max - x_min) - 1

print(data_normalized)