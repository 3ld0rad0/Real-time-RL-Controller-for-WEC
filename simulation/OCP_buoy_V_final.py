# %%

import matplotlib.pyplot as mpl
import numpy as np
from scipy.interpolate import interp1d
import sympy as sp
import mpmath as mp
from sympy.integrals.quadrature import gauss_legendre
from dataclasses import dataclass, field
import pathlib
from scipy.optimize import fmin_cg as Minimize
from scipy.integrate import solve_ivp
import subprocess
from IPython.display import Markdown, display, Latex
import pathlib, subprocess


def cmdcall( cmd ):
    output = subprocess.getoutput( cmd )
    # print(output)

# if not pathlib.Path("mpl_utils.py").exists():
#   cmdcall( "curl -O https://raw.githubusercontent.com/joaochenriques/ipynb_libs/main/mpl_utils.py" )

import utils.mpl_utils as mut
from  utils.mpl_utils import linecolors
mut.config_plots()

from matplotlib_inline.backend_inline import set_matplotlib_formats
set_matplotlib_formats('svg')



def printmd( string ): #Stampa il testo in formato Markdown nei Jupyter Notebook.
    display( Markdown( string ) )

def shellcmd( cmd, verbose=False ): #Esegue un comando di shell, catturando output ed errori.
    out = subprocess.run( cmd, shell=True, capture_output=True, text=True )
    if verbose: print( out.stdout, out.stderr )

# %%
# if not pathlib.Path("mpl_utils.py").exists():
#     shellcmd( "curl -O https://raw.githubusercontent.com/joaochenriques/ipynb_libs/main/mpl_utils.py" )
import utils.mpl_utils as mut

# %%
try:
    import google.colab # type: ignore
    try:
        from tqdm.notebook import tqdm
    except ModuleNotFoundError:
        shellcmd( "python -m pip install tqdm" )
        from tqdm.notebook import tqdm
    mut.config_plots( dpi = 280 )
except:
    try:
        from tqdm import tqdm
    except ModuleNotFoundError:
        shellcmd( "python -m pip install tqdm" )
        from tqdm import tqdm
    mut.config_plots()

from matplotlib_inline.backend_inline import set_matplotlib_formats
set_matplotlib_formats('svg')

# %%
@dataclass(frozen=True)
class Consts:

    digits: int = 15

# %%
@dataclass
class Node1D:

    # instance variables
    ID: int
    t: float

    # class variable (static member)
    new_ID: int = field( default = 0, init = False, repr = False)


    @staticmethod
    def __get_new_node_ID() -> int:
        Node1D.new_ID += 1
        return Node1D.new_ID


    def __init__( self, t ):
        self.ID = self.__get_new_node_ID()
        self.t = t

# %%
@dataclass
class Cell1D:

    ID: str
    nodes: tuple        # list of cell nodes

    tm: float           # cell mean point
    meas: float         # lenght of the element
    X: dict             # the key is the name of the var and the value is the
                        # matrix that stores the dofs
    tGL: np.array       # GL instants


    def __init__( self, nd0, nd1, 𝜏GL ):

        assert nd0 != None and nd1 != None

        self.nodes = ( nd0, nd1 )
        self.meas = nd1.t - nd0.t
        self.tm = 0.5 * ( nd0.t + nd1.t )
        self.tGL = self.meas / 2.0 * np.array( 𝜏GL, dtype=float ) + self.tm

        self.ID = f"C:{nd0.ID:08}:{nd1.ID:08}"
        self.X = {}

        assert self.meas > 0.0


    def CreateVariableVector( self, name, nvars, ndegree ):
        self.X[name] = np.zeros( ( ndegree+1, nvars ) )

# %%
@dataclass
class ODE_System:

    # instance variables
    𝝉GL: np.array       = field(repr=False) # Gauss-Legendre points
    wGL: np.array       = field(repr=False) # Gauss-Legendre weigths

    polys: np.array     = field(repr=False) # set of Legendre polynomials
    der_polys: np.array = field(repr=False) # derivatives of set of polys

    po_polys: np.array  = field(repr=False) # Legendre polynomials at 𝜏 = +1
    zr_polys: np.array  = field(repr=False) # Legendre polynomials at 𝜏 =  0
    mo_polys: np.array  = field(repr=False) # Legendre polynomials at 𝜏 = -1

    Mf_inv: np.array    = field(repr=False)
    Mb_inv: np.array    = field(repr=False)

    P: np.array         = field(repr=False)
    W: np.array         = field(repr=False)
    Wf_prime: np.array  = field(repr=False)
    Wb_prime: np.array  = field(repr=False)

    Fp: np.array        = field(repr=False)

    nodes_dic: list     = field(repr=False)
    cells_dic: dict     = field(repr=False)

    ts: np.array        = field(repr=False) # set of mesh points

    # class variables
    nvars: int          = field(repr=False) # number of system variables
    ndegree: int        = field(repr=False) # degree of approximation
    nGL: int            = field(repr=False) # degree: noGauss-Legendre points

    

    def __init__( self, ndegree, u_ndegree, nGL, tf, nt ):
        self.ndegree = ndegree
        self.u_ndegree = u_ndegree
        self.tf = tf
        self.nGL = nGL

        # create mesh
        self.nodes_dic = {}
        self.cells_dic = {}

        ########################################################################
        # assign values
        𝝉 = sp.Symbol('tau')

        self.polys = sp.Matrix( [ sp.legendre(i, 𝝉) for i in range( self.ndegree+1 ) ] )
        self.der_polys = sp.diff( self.polys, 𝝉 )

        po_polys = self.polys.subs(𝝉,+1)
        zr_polys = self.polys.subs(𝝉, 0)
        mo_polys = self.polys.subs(𝝉,-1)

        Mf = sp.integrate( self.der_polys * self.polys.transpose(), (𝝉,-1,1) ) \
          - po_polys * po_polys.transpose()
        self.Mf_inv = np.array( Mf.inverse().evalf( Consts.digits ) ).astype( float )

        Mb = sp.integrate( self.der_polys * self.polys.transpose(), (𝝉,-1,1) ) \
          + mo_polys * mo_polys.transpose()
        self.Mb_inv = np.array( Mb.inverse().evalf( Consts.digits ) ).astype( float )

        self.po_polys = sp.matrix2numpy( po_polys.evalf( Consts.digits ) ).astype( float ).flatten()
        self.zr_polys = sp.matrix2numpy( zr_polys.evalf( Consts.digits ) ).astype( float ).flatten()
        self.mo_polys = sp.matrix2numpy( mo_polys.evalf( Consts.digits ) ).astype( float ).flatten()

        self.𝝉GL, self.wGL = sp.integrals.quadrature.gauss_legendre( self.nGL, Consts.digits )
        self.wGL = np.array( self.wGL, dtype = float )

        P = sp.Matrix( [ [ sp.legendre(i, self.𝝉GL[j] ) for i in range(self.ndegree+1) ] for j in range(self.nGL) ] )
        self.P = np.array( P.evalf( Consts.digits ) ).astype( float )

        Pu = sp.Matrix( [ [ sp.legendre(i, self.𝝉GL[j] ) for i in range(self.u_ndegree+1) ] for j in range(self.nGL) ] )
        self.Pu = np.array( Pu.evalf( Consts.digits ) ).astype( float )

        W = sp.Matrix( [ [ self.wGL[i] * sp.legendre(j, self.𝝉GL[i] ) for i in range(self.nGL) ] for j in range(self.ndegree+1) ] )
        self.W = np.array( W.evalf( Consts.digits ) ).astype( float )

        Wf_prime = mo_polys * po_polys.transpose()
        self.Wf_prime = np.array( Wf_prime.evalf( Consts.digits ) ).astype( float )

        Wb_prime = po_polys * mo_polys.transpose()
        self.Wb_prime = np.array( Wb_prime.evalf( Consts.digits ) ).astype( float )

        self.ts = np.linspace( 0.0, tf, nt+1 )
        # self.ts = self.discretize_domain( nt, tf )

        nodes_lst = []
        for t in self.ts:
            nd = Node1D( t )
            self.nodes_dic[ nd.ID ] = nd
            nodes_lst.append( nd )

        for i in range( 1, len(nodes_lst) ): 
            cl = Cell1D( nodes_lst[i-1], nodes_lst[i], self.𝝉GL )
            self.cells_dic[ cl.ID ] = cl


    def CreateVariableVector( self, name, nvars, ndegree ):

        for cl in self.cells_dic.values():
            cl.CreateVariableVector( name, nvars, ndegree )


    def InitForward( self, cl ):
        pass


    def IntegrateForward( self, var_name, X0, nonlinear_iter ):

        for cl in self.cells_dic.values():
            self.InitForward( cl )

        for cl in self.cells_dic.values():

            cX = cl.X[var_name]
            X = np.copy( cX )

            for _ in range( nonlinear_iter ):
                F  =  self.Forward_RHS( cl, X )
                f  = -cl.meas / 2.0 * np.dot( self.W, F )
                f -=  np.dot( self.Wf_prime, X0 )
                X  =  np.dot( self.Mf_inv, f )
            X0[:,:] = cX[:,:] = X[:,:]
            pass


    def InitBackward( self, cl ):
        pass


    def IntegrateBackward( self, var_name, λ0, nonlinear_iter ):

        for cl in list( reversed( list( self.cells_dic.values() ) ) ):
            self.InitBackward( cl )

        for cl in list( reversed( list( self.cells_dic.values() ) ) ):

            cλ = cl.X[var_name]
            λ = np.copy( cλ )

            for _ in range( nonlinear_iter ):
                F  =  self.Backward_RHS( cl, λ )
                f  = -cl.meas / 2.0 * np.dot( self.W, F )
                f +=  np.dot( self.Wb_prime, λ0 )
                λ  =  np.dot( self.Mb_inv, f )
            λ0[:,:] = cλ[:,:] = λ[:,:]
            pass


    def Forward_RHS( self, cl, X ):
        raise NotImplementedError()


    def Backward_RHS( self, cl, λ ):
        raise NotImplementedError()


    def dump( self, name, var, npnts ):

        pnts = np.linspace( -1.0, +1.0, npnts )
        𝝉 = sp.Symbol('tau')

        pnts_matx = np.zeros( (npnts, self.ndegree+1) )
        for i, pnt in enumerate( pnts ):
            poly_val = self.polys.subs(𝝉, pnt)
            pnts_matx[i,:] = sp.matrix2numpy( poly_val.evalf( Consts.digits ) ).astype( float ).flatten()

        t_lst = []
        x_lst = []

        t2_lst = [] # interval extrems
        x2_lst = []

        for l, cl in enumerate( self.cells_dic.values() ):
            for i, pnt in enumerate( pnts ):
                t = cl.meas / 2.0 * pnt + cl.tm
                x = np.dot( pnts_matx[i], cl.X[name][:,var] )

                t_lst.append( t )
                x_lst.append( x )

            t2_lst.append( t_lst[-1] )
            x2_lst.append( x_lst[-1] )

            t_lst.append( np.nan )
            x_lst.append( np.nan )

        t_lst.pop()
        x_lst.pop()

        t2_lst.pop()
        x2_lst.pop()

        return np.array( t_lst ), np.array( x_lst ), np.array( t2_lst ), np.array( x2_lst )


    def dump_GL( self, name, var, RMS_nGL ):

        RMS_GL_pnts, _ = np.polynomial.legendre.leggauss( RMS_nGL )

        𝝉 = sp.Symbol('tau')

        pnts_matx = np.zeros( ( RMS_nGL, self.ndegree+1 ) )
        for i, pnt in enumerate( RMS_GL_pnts ):
            poly_val = self.polys.subs(𝝉, pnt)
            pnts_matx[i,:] = sp.matrix2numpy( poly_val.evalf( Consts.digits ) ).astype( float ).flatten()

        t_lst = []
        x_lst = []

        for cl in self.cells_dic.values():
            t_cl = []
            x_cl = []
            for i, pnt in enumerate( RMS_GL_pnts ):
                t = cl.meas / 2.0 * pnt + cl.tm
                x = np.dot( pnts_matx[i], cl.X[name][:,var] )

                t_cl.append( t )
                x_cl.append( x )

            t_lst.append( np.array( t_cl ) )
            x_lst.append( np.array( x_cl ) )

        return t_lst, x_lst
    
    
    def u_dump_GL( self, name, var, RMS_nGL ):

        RMS_GL_pnts, _ = np.polynomial.legendre.leggauss( RMS_nGL )

        𝝉 = sp.Symbol('tau')

        pnts_matx = np.zeros( ( RMS_nGL, self.u_ndegree+1 ) )
        for i, pnt in enumerate( RMS_GL_pnts ):
                poly_val = sp.Matrix( self.polys[0:self.u_ndegree+1] ).subs(𝝉, pnt)
                pnts_matx[i,:] = sp.matrix2numpy( poly_val.evalf( Consts.digits ) ).astype( float ).flatten()

        t_lst = []
        x_lst = []

        for cl in self.cells_dic.values():
            t_cl = []
            x_cl = []
            for i, pnt in enumerate( RMS_GL_pnts ):
                t = cl.meas / 2.0 * pnt + cl.tm
                x = np.dot( pnts_matx[i], cl.X[name][:,var] )

                t_cl.append( t )
                x_cl.append( x )

            t_lst.append( np.array( t_cl ) )
            x_lst.append( np.array( x_cl ) )

        return t_lst, x_lst
    

    def dump_u( self, name, var, npnts ):

        pnts = np.linspace( -1.0, +1.0, npnts )
        𝝉 = sp.Symbol('tau')

        pnts_matx = np.zeros( (npnts, self.u_ndegree+1) )

        for i, pnt in enumerate( pnts ):
            poly_val = sp.Matrix( self.polys[0:self.u_ndegree+1] ).subs(𝝉, pnt)
            pnts_matx[i,:] = sp.matrix2numpy( poly_val.evalf( Consts.digits ) ).astype( float ).flatten()

        t_lst = []
        x_lst = []

        t2_lst = [] # interval extrems
        x2_lst = []

        for cl in self.cells_dic.values():
            for i, pnt in enumerate( pnts ):
                t = cl.meas / 2.0 * pnt + cl.tm
                x = np.dot( pnts_matx[i], cl.X[name][:,var] )

                t_lst.append( t )
                x_lst.append( x )

            t2_lst.append( t_lst[-1] )
            x2_lst.append( x_lst[-1] )

            t_lst.append( np.nan )
            x_lst.append( np.nan )

        t_lst.pop()
        x_lst.pop()

        t2_lst.pop()
        x2_lst.pop()

        return np.array( t_lst ), np.array( x_lst ), np.array( t2_lst ), np.array( x2_lst )
# %%
@dataclass
class Problem1( ODE_System ):


    def PontryaginSetup( self ):
        # analytical description of the control problem
        x = sp.DeferredVector('x')  # x[0]=z, x[1]=v
        λ = sp.DeferredVector('λ')  # λ[0]=λ₁, λ[1]=λ₂
        u = sp.DeferredVector('u')

        self.t_sym = sp.Symbol('t')

        #epsilon = 1e-3

        module = 'numpy'

        # Hamiltonian
        self.ℋ = self.C * x[1]**2 + λ[0]*x[1] + λ[1]*((self.Gamma*self.Aw*sp.cos(self.omega*self.t_sym) - (self.B_omega+self.C+self.G*u[0])*x[1] - self.ktot*x[0])/self.mtot)
        self.fℋ = sp.lambdify((self.t_sym,x,u,λ), self.ℋ, modules=module)

        display( Latex( rf'\mathcal{{H}} = {sp.latex(self.ℋ)}') )

        # Final Cost
        self.𝒞 = sp.Float(0)
        display( Latex( rf'\mathcal{{C}} = {sp.latex(self.𝒞)}' ) )
        self.f𝒞 = sp.lambdify( x, self.𝒞, modules=module )

        states_lst   = [ self.ℋ.diff( λ[i] ) for i in range(0,self.nvars) ]
        costates_lst = [-self.ℋ.diff( x[i] ) for i in range(0,self.nvars) ]
        BCf_lst      = [ self.𝒞.diff( x[i] ) for i in range(0,self.nvars) ]
        H_func       = self.ℋ
        dHdU_lst     = [ self.ℋ.diff( u[i] ) for i in range(0,self.uvars) ]

        self.RHS_States   = sp.lambdify( (self.t_sym, x, u), states_lst, modules=module )
        self.RHS_CoStates = sp.lambdify( (self.t_sym, x, u, λ), costates_lst, modules=module )
        self.CoStatesBC   = sp.lambdify( (self.t_sym, x, u), BCf_lst, modules=module )
        self.HOpt         = sp.lambdify( (self.t_sym, x, u, λ), H_func, modules=module )
        self.dHOptdu      = sp.lambdify( (self.t_sym, x, u, λ), dHdU_lst, modules=module )


    def __init__( self, ndegree, u_ndegree, nGL, tf, nt, x0, params):

        super().__init__( ndegree, u_ndegree, nGL, tf, nt )

        self.nvars = 2
        self.uvars = 1
        self.x0 = x0
        self.tf = tf

        self.CreateVariableVector( 'x', nvars = self.nvars, ndegree = self.ndegree )
        self.CreateVariableVector( 'λ', nvars = self.nvars, ndegree = self.ndegree )
        self.CreateVariableVector( 'u', nvars = self.uvars, ndegree = self.u_ndegree )
        self.Fp = np.zeros( ( self.nGL, self.nvars ) )

        # Physical parameters of the problem (to be inserted from params)
        self.Gamma = params['Gamma']       # Amplitude of the excitation force per unit wave amplitude
        self.Aw = params['Aw']             # Wave amplitude
        self.omega = params['omega']       # Wave frequency
        self.mtot = params['mtot']         # Total mass = m + A(∞)
        self.B_omega = params['B_omega']   # Hydrodynamic damping coefficient
        self.C = params['C']               # PTO damping coefficient
        self.G = params['G']               # Large coefficient for bang-bang control
        self.ktot = params['ktot']         # Total stiffness coefficient (hydrostatic + PTO)

        self.PontryaginSetup()

    def InitProblem( self ):
        for cl in self.cells_dic.values():
            U = cl.X['u']
            U[:,:] = 0.0


    def Forward_RHS( self, cl, X ):

        # Compute the state variables at Gauss-Legendre points
        Xp = np.dot( self.P, X )
        # Compute the control variables at Gauss-Legendre points
        Up = np.dot( self.Pu, cl.X['u'] )

        # Gauss-Legendre points corresponding to time
        tp = cl.tGL  
        # Evaluate the right-hand side of the state equations at each Gauss-Legendre point
        self.Fp[:,:] = [ self.RHS_States(t, x, u) for t, x, u in zip(tp, Xp, Up) ]

        return self.Fp


    def Backward_RHS( self, cl, λ ):

        Xp = np.dot( self.P, cl.X['x'] )
        λp = np.dot( self.P, λ )
        Up = np.dot( self.Pu, cl.X['u'] )

        tp = cl.tGL
        self.Fp[:,:] = [ self.RHS_CoStates(t, x, u, l) for t, x, u, l in zip(tp, Xp, Up, λp) ]
        
        return self.Fp


    def IntegrateForward( self, nonlinear_iter = 20 ):

        Xbc = np.array( [self.x0] )

        X0 = np.zeros( ( self.ndegree+1, self.nvars ) )
        X0[0,:] = Xbc
        super().IntegrateForward( 'x', X0, nonlinear_iter )


    def IntegrateBackward( self, nonlinear_iter = 10 ):
        cl = list( self.cells_dic.values() )[-1]
        X = np.dot( self.P, cl.X['x'] )
        U = np.dot( self.Pu, cl.X['u'] )
        tf = self.tf
        λf = self.CoStatesBC( tf, X, U )


        λ0 = np.zeros( ( self.ndegree+1, self.nvars ) )
        λ0[0,:] = λf
        super().IntegrateBackward( 'λ', λ0, nonlinear_iter )


    def funcControl( self, u, cl ):

        Xp = np.dot( self.P, cl.X['x'] )
        λp = np.dot( self.P, cl.X['λ'] )
        Up = np.dot( self.Pu, u )

        tp = cl.tGL
        fp = np.fromiter( (self.HOpt(t, x, u, l) for t, x, u, l in zip(tp, Xp, Up, λp)), dtype=float )

        ff = np.dot( fp, self.wGL )
        return ff


    def OptimalControl( self, i ):

        for cl in self.cells_dic.values():

            U0 = np.copy( cl.X['u'] )
            U0[:] = 0
            R0 = self.funcControl( U0, cl )
            
            U1 = np.copy( cl.X['u'] )
            U1[:] = 1         
            R1 = self.funcControl( U1, cl )
            
            if R0 >= R1:
                cl.X['u'] = U0
            else:
                cl.X['u'] = U1

    
def calculate_energy(fsys, C, RMS_nGL=5):
    # Obtain Gauss-Legendre points for numerical integration
    RMS_GL_pnts, RMS_GL_w = np.polynomial.legendre.leggauss(RMS_nGL)

    energy = 0.0

    for cl in fsys.cells_dic.values():
        # Transform GL points to the real temporal cell
        t_GL = cl.meas / 2.0 * RMS_GL_pnts + cl.tm

        # Compute interpolated velocity at GL points
        v_GL = np.zeros(RMS_nGL)
        for i, tau in enumerate(RMS_GL_pnts):
            poly_vals = np.array([sp.legendre(j, tau) for j in range(fsys.ndegree+1)], dtype=float)
            v_GL[i] = np.dot(poly_vals, cl.X['x'][:, 1])  # velocity (var=1)

        # Compute the local integral for energy
        integrand = C * v_GL**2
        local_energy = (cl.meas / 2.0) * np.dot(integrand, RMS_GL_w)

        energy += local_energy

    return energy


def Wave_data(T, Aw,tf,a,G_star,C_star):
    # Useful parameters
    g = 9.81  # Acceleration due to gravity [m/s^2]
    rho = 1025    # Water density [kg/m^3]

    wave_velocity = g * T / (2 * np.pi)   # Wave velocity [m/s]
    wave_l = wave_velocity * T            # Wave length [m]
    k = 2*np.pi/wave_l                    # Wave number [m^-1]    
    omega = 2*np.pi/T                     # Wave frequency [rad/s]

    T_final = tf                     # Final Time [s]
    t_space=np.linspace(0,T_final,1000)
    wave_t=Aw*np.cos(omega*t_space)

    S_cs = np.pi*a**2                     # Buoy cross sectional area [m^2]
    Volume = 2/3*np.pi*a**3               # Buoy volume [m^3]

    m =  rho*Volume                       # Buoy mass [kg] = displaced water mass [kg], so that buoy density = water density
    ka = k*a                              # Wave number * buoy radius [-]

    # Matrix containing the table data
    ka_table = np.array([
        #ka    #A*(ka) #B*(ka)
        [0,    0.8310, 0],
        [0.05, 0.8764, 0.1036],
        [0.1,  0.8627, 0.1816],
        [0.2,  0.7938, 0.2793],
        [0.3,  0.7157, 0.3254],
        [0.4,  0.6452, 0.3410],
        [0.5,  0.5861, 0.3391],
        [0.6,  0.5381, 0.3271],
        [0.7,  0.4999, 0.3098],
        [0.8,  0.4698, 0.2899],
        [0.9,  0.4464, 0.2691],
        [1.0,  0.4284, 0.2484],
        [1.2,  0.4047, 0.2096],
        [1.4,  0.3924, 0.1756],
        [1.6,  0.3871, 0.1469],
        [1.8,  0.3864, 0.1229],
        [2.0,  0.3884, 0.1031],
        [2.5,  0.3988, 0.0674],
        [3.0,  0.4111, 0.0452],
        [4.0,  0.4322, 0.0219],
        [5.0,  0.4471, 0.0116],
        [6.0,  0.4574, 0.0066],
        [7.0,  0.4647, 0.0040],
        [8.0,  0.4700, 0.0026],
        [9.0,  0.4740, 0.0017],
        [10.0, 0.4771, 0.0012],
        [np.inf, 0.5, 0]
    ])

    # Interpolation functions for A* and B*
    A_star_interp = interp1d(ka_table[:, 0], ka_table[:, 1], kind='linear', fill_value="extrapolate")
    B_star_interp = interp1d(ka_table[:, 0], ka_table[:, 2], kind='linear', fill_value="extrapolate")

    A_star = ka_table[-1, 1]          # Dimensionless added mass [-] at infinite frequency
    B_star = B_star_interp(ka)        # Dimensionless damping coefficient [-]

    A = 2/3*np.pi*a**3*rho*A_star            # Added mass [kg]
    B = 2/3*np.pi*a**3*rho*omega*B_star      # Damping coefficient [kg/s]

    # PTO Data
    C=0
    use_resonance = False  # Set this to False to use non-resonance conditions

    if use_resonance:
        C = B                             # PTO damping coefficient [kg/s]
        K = omega**2*(m+A)-rho*g*S_cs     # PTO stiffness coefficient [N/m]
    else:
        C = C_star*a**(5/2)*rho*g**(1/2)  # PTO damping coefficient [kg/s]
        K = 600                           # PTO stiffness coefficient [N/m]
    
    prova_edo= 1

    if prova_edo:
        C=0.3*B
        K=0

    # Excitation force

    Gamma = np.sqrt((2*rho*g**3*B)/(omega**3)) # Excitation force amplitude per unit incident wave amplitude [N/m]

    

    # Definition of physical parameters for the problem (realistic example)
    params = {
        'Gamma': Gamma,
        'Aw': Aw,
        'omega': omega,
        'mtot': m + A,
        'B_omega': B,
        'C': C,
        'G': G_star * (m + A),  # choose G_star appropriately large (e.g., G_star=1000)
        'ktot': rho * g * S_cs + K,
        'T': T,
        'G_star': G_star,
        'K': K,
    }

    return params


class OscillatorSystem:
    def __init__(self, params, tf):
        self.params = params
        self.tf = tf

    def system(self, t, X):
        x1, x2 = X
        fe_t = self.params['Gamma'] * self.params['Aw'] * np.cos(self.params['omega'] * t)
        dx1_dt = x2
        dx2_dt = (1 / self.params['mtot']) * (
            -(self.params['B_omega'] + self.params['C']) * x2
            - self.params['ktot'] * x1
            + fe_t
        )
        return [dx1_dt, dx2_dt]

    def solve(self, t_span=None, t_eval=None, initial_conditions=(0.0, 0.0), method='RK45'):
        if t_span is None:
            t_span = (0, self.tf)
        if t_eval is None:
            t_eval = np.linspace(t_span[0], t_span[1], 1000)

        sol = solve_ivp(self.system, t_span, initial_conditions, t_eval=t_eval, method=method)
        self.t = sol.t
        self.x = sol.y[0]
        self.v = sol.y[1]

        return self.t, self.x, self.v



molt=5
tf=60*molt
tf = 100
x0=[0.0, 0.0]

# Wave data
T = 9                                 # Wave period [s]
Aw = 0.8                                # Wave height [m]

# Buoy data
a = 5                                 # Hemisperical buoy radius [m]

C_star= 0.5
G_star = 5

params = Wave_data(T,Aw,tf,a,G_star,C_star)


# Display the parameters of the system in a structured format
print("System Parameters:")
for key, value in params.items():
    print(f"{key:<15}: {value:.5e}" if isinstance(value, (float, int)) else f"{key:<15}: {value}")


# Physical parameters of the problem
Gamma = params['Gamma']  # Amplitude of the excitation force per unit wave amplitude
Aw = params['Aw']  # Wave amplitude
omega = params['omega']  # Wave frequency
C = params['C']  # PTO damping coefficient
K = params['K']  # PTO stiffness coefficient

oscillator = OscillatorSystem(params, tf)
t_array, x_array, v_array = oscillator.solve()


nt=300*molt
ndegree=3
u_degree=0
nGL=ndegree+1

fsys = Problem1( ndegree = ndegree, u_ndegree =u_degree, nGL = nGL, tf = tf, nt = nt , x0 = x0, params=params )

# %%
plot_pnts = 500

fsys.InitProblem()


for i in tqdm( range(50+1) ):

    fsys.IntegrateForward( nonlinear_iter = 10 )
    fsys.IntegrateBackward( nonlinear_iter = 10 )

    fsys.OptimalControl( i )


E_abs = calculate_energy(fsys, C)

print(f"Absorbed energy: {E_abs*10**(-6):.2f} MJ")
# %%

t_space = np.linspace(0, tf, 1000)
fe_t = Gamma*Aw*np.cos(omega*t_space) 

ft1, fx1, ft1p, fx1p = fsys.dump( 'x', var=0, npnts=plot_pnts )
ft2, fy1, ft2p, fy1p = fsys.dump( 'x', var=1, npnts=plot_pnts )
bt1, bx1, bt1p, bx1p = fsys.dump( 'λ', var=0, npnts=plot_pnts )
bt2, by1, bt2p, by1p = fsys.dump( 'λ', var=1, npnts=plot_pnts )
ut1, ux1, ut1p, ux1p = fsys.dump_u( 'u', var=0, npnts=plot_pnts )
 

# # %%
fig, (ax1, ax2) = mpl.subplots(nrows=2, ncols=1, figsize=(12, 6))
fig.subplots_adjust(hspace=0.4, wspace=0.6)  # Adjust spacing between plots

# fig2, (ax3, ax4, ax5) = mpl.subplots(nrows=1, ncols=3, figsize=(12, 5))
# fig2.subplots_adjust(hspace=0.4, wspace=0.6)  # Adjust spacing between plots


t_in=4*T

# Plot x(t)
ax1.plot(ft1, fx1, '-', label=r'Buoy displacement $\xi(t)$ with control', lw=2, color='blue')
ax1.plot(t_array, x_array, '--', label=r'Buoy displacement $\xi(t)$ with no control',lw=2,color='red')
ax1.set_ylabel(r'Displacement [m]')
ax1.set_xlabel('$t [s]$')
ax1.legend(loc='upper right',fontsize='small')
ax1.set_ylim(-3, 3)
ax1.set_xlim(tf-t_in, tf)
ax1.tick_params(axis='both', which='major', labelsize=14, labelcolor='black', width=2)
ax1.yaxis.set_tick_params(labelsize=14, labelcolor='black', width=2)
ax1.xaxis.set_tick_params(labelsize=14, labelcolor='black', width=2)
ax1.yaxis.set_tick_params(labelsize=14, labelcolor='black', width=2)
ax1.xaxis.set_tick_params(labelsize=14, labelcolor='black', width=2)
ax1.grid()

# Plot v(t)
ax2.plot(ft2, fy1, '-', label=r'Buoy velocity $\dot{\xi}(t)$ with control', lw=2, color='blue')
ax2.plot(t_array, v_array, '--',label=r'Buoy velocity $\dot{\xi}(t)$ with no control', lw=2,color='red')
ax2.plot(t_space, fe_t*1e-6, '-', label=r'Excitation force $10^{-6} \times f_{e}(T)$', lw=2, color='#17becf')
ax2.set_ylabel("Velocity [m/s] vs\n Wave force [MN]")
ax2.set_xlabel('$t [s]$')
ax2.set_ylim(-3, 3)
ax2.set_xlim(tf-t_in, tf)
ax2.legend(loc='upper right',fontsize='small')
ax2.tick_params(axis='both', which='major', labelsize=14, labelcolor='black', width=2)
ax2.yaxis.set_tick_params(labelsize=14, labelcolor='black', width=2)
ax2.xaxis.set_tick_params(labelsize=14, labelcolor='black', width=2)
ax2.yaxis.set_tick_params(labelsize=14, labelcolor='black', width=2)
ax2.xaxis.set_tick_params(labelsize=14, labelcolor='black', width=2)
ax2.grid()

# Save the first figure as OCP_Buoy_Dynamics
file_name_dynamics = 'OCP_Buoy_Dynamics_G_star_{:.2f}_Aw_{:.2f}_T_{:.2f}_C_{:d}_K_{:.2f}.pdf'.format(
    params['G_star'], params['Aw'], params['T'], int(params['C']), params['K']
)
fig.tight_layout()
fig.savefig(file_name_dynamics)

# Create a single figure with 2x2 subplots for ax3, ax4, ax5, and ax6
fig_combined, axs = mpl.subplots(nrows=2, ncols=2, figsize=(12, 10))
fig_combined.subplots_adjust(hspace=0.4, wspace=0.4)  # Adjust spacing between plots


# Plot λ1(t) in subplot (1, 1)
ax1 = axs[0, 0]
ax1.plot(bt1, bx1, '-', label=r"Costate $\lambda_1(t)$", lw=2, color='green')
ax1.set_ylabel(r'$\lambda_1(t)$')
ax1.set_xlabel(r'$t \, [\mathrm{s}]$')
ax1.set_xlim(tf-t_in, tf)
ax1.set_ylim(-2*1e6, 2*1e6)
ax1.legend(loc='upper right')
ax1.tick_params(axis='both', which='major', labelsize=14, labelcolor='black', width=2)
ax1.ticklabel_format(axis='y', style='sci', scilimits=(-2, 2))  # Scientific notation for y-axis
ax1.grid()

# Plot λ2(t) in subplot (2, 1)
ax2 = axs[1, 0]
ax2.plot(bt2, by1, '-', label=r"Costate $\lambda_2(t)$", lw=2, color='orange')
ax2.set_ylabel(r'$\lambda_2(t)$')
ax2.set_xlabel(r'$t \, [\mathrm{s}]$')
ax2.set_xlim(tf-t_in, tf)
ax2.set_ylim(-1.5*1e6, 1.5*1e6)
ax2.legend(loc='upper right')
ax2.tick_params(axis='both', which='major', labelsize=14, labelcolor='black', width=2)
ax2.ticklabel_format(axis='y', style='sci', scilimits=(-2, 2))  # Scientific notation for y-axis
ax2.grid()

# Plot u(t) in subplot (1, 2)
ax3 = axs[0, 1]
ax3.plot(ut1, ux1, '-', label="Control function u(t)", lw=2, color='red')
ax3.set_ylabel('$u[t]$', fontweight='bold')
ax3.set_xlabel('$t [s]$', fontweight='bold')
ax3.set_xlim(tf-t_in, tf)
ax3.set_ylim(-0.2, 1.2)
ax3.legend(loc='upper right')
ax3.tick_params(axis='both', which='major', labelsize=14, labelcolor='black', width=2)
ax3.grid()

# Plot the product -x[1]*lambda[1]*G in subplot (2, 2)
ax4 = axs[1, 1]
product_t = []
product_values = []

for cl in fsys.cells_dic.values():
    Xp = np.dot(fsys.P, cl.X['x'])
    λp = np.dot(fsys.P, cl.X['λ'])
    tp = cl.tGL
    for t, x, l in zip(tp, Xp, λp):
        product_t.append(t)
        product_values.append(-1 * x[1] * l[1] * fsys.G)

ax4.plot(product_t, product_values, '-', label=r"Switching condition function", lw=2, color='purple')
ax4.set_ylabel(r'$-v(t) \cdot \lambda_2(t) \cdot G$', fontweight='bold')
ax4.set_xlabel(r'$t \, [\mathrm{s}]$', fontweight='bold')
ax4.set_xlim(tf-t_in, tf)
ax4.set_ylim(-6*1e13, 3*1e13)
ax4.legend(loc='upper right')
ax4.tick_params(axis='both', which='major', labelsize=14, labelcolor='black', width=2)
ax4.ticklabel_format(axis='y', style='sci', scilimits=(-2, 2))  # Scientific notation for y-axis
ax4.grid()

# Save the combined figure
file_name_combined = 'OCP_buoy_combined_G_star_{:.2f}_Aw_{:.2f}_T_{:.2f}_C_{:d}_K_{:.2f}.pdf'.format(
    params['G_star'], params['Aw'], params['T'], int(params['C']), params['K']
)
fig_combined.tight_layout()
fig_combined.savefig(file_name_combined)

mpl.show()
