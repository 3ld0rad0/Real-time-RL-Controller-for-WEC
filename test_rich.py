import sys
import time
from rich.progress import Progress, TextColumn, BarColumn, TaskProgressColumn
from rich.console import Console

with Progress(
    TextColumn("[progress.description]{task.description}"),
    BarColumn(),
    TaskProgressColumn(),
    console=Console(force_terminal=True, force_interactive=True),
    transient=True,
) as progress:
    task = progress.add_task("[cyan]Simulating...", total=10)
    for i in range(10):
        time.sleep(0.1)
        progress.update(task, advance=1)
