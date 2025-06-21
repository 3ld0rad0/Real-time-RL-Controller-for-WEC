from collections import deque
import numpy as np

p = deque(maxlen = 5)

h = []
for i in range (10):
    p.append(([i,i,i],[i+1,i+1,i+1],[i+2,i+2,i+2]))

array = np.array(p)

for tuple in array:
    for t,x,v in zip(tuple[0], tuple[1], tuple[2]):
        h.append(t)

a = [1,2,3]
print(a[1:])

start = 1.0
stop = 2.0
step = 0.5 
cactus = np.arange(start, stop+0.1, step)

print(cactus)
