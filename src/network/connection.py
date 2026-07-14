import socket
import json
import logging
import numpy as np

logger = logging.getLogger(__name__)

class NumPyEncoder(json.JSONEncoder):
    """Custom JSON encoder to automatically serialize NumPy data types."""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.bool_):
            return bool(obj)
        return super().default(obj)

class JSONSocketWrapper:
    """
    A robust wrapper around a TCP socket to send and receive JSON messages 
    safely without packet coalescing issues. It uses a line-buffered stream 
    to parse one JSON object per line.
    """
    def __init__(self, sock):
        self.sock = sock
        # Create a file-like object to read line-by-line. This avoids
        # coalesced packet problems because we only process up to the next \n.
        self.rfile = sock.makefile('r', encoding='utf-8')
        
    def send_msg(self, payload):
        """Serialize a dictionary to JSON and send it with a newline delimiter."""
        try:
            # We append newline to separate JSON objects
            data = json.dumps(payload, cls=NumPyEncoder) + "\n"
            self.sock.sendall(data.encode('utf-8'))
            return True
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return False
            
    def recv_msg(self):
        """Read exactly one newline-delimited JSON message from the buffer."""
        try:
            line = self.rfile.readline()
            if not line:
                return None
            return json.loads(line.strip())
        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON payload: {line}")
            return None
        except socket.timeout:
            raise
        except Exception as e:
            logger.error(f"Error receiving message: {e}")
            return None

    def close(self):
        """Close the stream and the underlying socket."""
        try:
            self.rfile.close()
        except:
            pass
        try:
            self.sock.close()
        except:
            pass
