from collections import deque
import numpy as np



# Dati di esempio
data = []

for i in range(5):
    data.append((i, i+1, i+2))


#res = [x[1] for x in data]

s = np.sum(data)
print(s)