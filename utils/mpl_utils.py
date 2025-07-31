import matplotlib.pyplot as mpl
import numpy as np
from cycler import cycler
import os

linestyles = (  (  6, 0 ), 
                (  6, 2 ), 
                (  6, 1.5, 1.5, 1.5 ),
                (  8, 1.5, 1.5, 1.5, 1.5, 1.5 ), 
                (  8, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5 ), 
                (  2, 2 ), 
                ( 11, 3, 3, 3 ), 
                ( 11, 2, 5, 2 ), 
                ( 17, 4 ), 
                ( 17, 2, 2 , 2 )
             )          

linecolors = (  '#1f77b4', # blue
                '#ff7f0e', # orange
                '#2ca02c', # green
                '#d62728', # red 
                '#9467bd', # violet
                '#8c564b', # brown
                '#17becf', # light blue                
                '#ce6dbd', # light violet
                '#1b9e77', # light green
                '#393b79', # dark bue
)
                
def config_plots( font_sans_serif=False, dpi=None ):
    
    if font_sans_serif:
      mpl.rcParams['mathtext.fontset'] = 'dejavusans'
      mpl.rcParams['font.family'] = 'DejaVu Sans'
      mpl.rcParams['font.sans-serif'] = 'dejavusans'
    else:
      mpl.style.use('classic')
      mpl.rcParams['figure.facecolor'] = '1.0'
      mpl.rcParams['font.family'] = 'STIXGeneral'
      mpl.rcParams['font.sans-serif'] = 'stix'
      mpl.rcParams['mathtext.fontset'] = 'stix'

      VFont=16
      mpl.rcParams['axes.titlesize'] = VFont
      mpl.rcParams['axes.labelsize'] = VFont
      mpl.rcParams['xtick.labelsize'] = VFont*0.9
      mpl.rcParams['ytick.labelsize'] = VFont*0.9
      mpl.rcParams['legend.fontsize'] = VFont*0.9    

    mpl.rcParams['axes.formatter.useoffset'] = False
    mpl.rcParams['savefig.directory'] = ""
    mpl.rcParams['savefig.format'] = 'pdf'
    mpl.rcParams["figure.figsize"] = ( 6, 4.5 )
    mpl.rcParams["lines.markersize"] = 5

    if dpi != None:    
      mpl.rcParams["figure.dpi"] = dpi

    ls = ( (0,l) for l in linestyles )
    dc = ( cycler( linestyle = ls ) + cycler('color', linecolors ) )    
    
    mpl.rcParams["axes.prop_cycle"] = dc
    mpl.rcParams['lines.linewidth'] = 1.5

    mpl.rcParams['figure.subplot.left'  ] = 0.14
    mpl.rcParams['figure.subplot.right' ] = 0.96
    mpl.rcParams['figure.subplot.bottom'] = 0.14
    mpl.rcParams['figure.subplot.top'   ] = 0.95
    mpl.rcParams['figure.subplot.wspace'] = 0.20
    mpl.rcParams['figure.subplot.hspace'] = 0.20

def useTeX():
    cmds = ( ( 'sudo apt-get install texlive-latex-recommended' ),
             ( 'sudo apt-get install dvipng texlive-fonts-recommended' ),
             ( 'wget http://mirrors.ctan.org/macros/latex/contrib/type1cm.zip' ),
             ( 'unzip type1cm.zip -d /tmp/type1cm' ),
             ( 'cd /tmp/type1cm/type1cm/ && sudo latex type1cm.ins' ),
             ( 'sudo mkdir /usr/share/texmf/tex/latex/type1cm' ),
             ( 'sudo cp /tmp/type1cm/type1cm/type1cm.sty /usr/share/texmf/tex/latex/type1cm' ),
             ( 'sudo texhash' ) )

    for cmd in cmds:
        print( cmd )
        os.system( cmd )
        
    mpl.rcParams['text.usetex'] = True
    mpl.rc('font', **{'family': 'serif', 'serif': ['Computer Modern']})

def inline_label( lbl, x, y, i, fontsize = 8, color = 'k' ):
    
  # get screen coordinates (physical display)
  screen_dx, screen_dy = mpl.gca().transData.transform( (x[i+1], y[i+1]) ) \
                       - mpl.gca().transData.transform( (x[i-1], y[i-1]) )
    
  angle = ( np.degrees( np.arctan2( screen_dy, screen_dx ) ) + 90 ) % 180 - 90
  
  mpl.gca().text( x[i], y[i], lbl,
                  rotation=angle,
                  fontsize=fontsize, color=color, 
                  horizontalalignment='center',
                  verticalalignment='center', 
                  bbox=dict( boxstyle='round, pad=-0.2', 
                             edgecolor='k', facecolor='w',  
                             linewidth=0,
                             alpha=0.90) )
