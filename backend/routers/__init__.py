from .auth import router as auth_router
from .users import router as users_router
from .donors import router as donors_router
from .screening import router as screening_router
from .donations import router as donations_router
from .blood_units import router as blood_units_router, custody_router
from .laboratory import router as laboratory_router
from .components import router as components_router
from .quarantine import router as quarantine_router
from .qc_validation import router as qc_validation_router
from .inventory import router as inventory_router
from .requests import router as requests_router, issuance_router
from .disposition import return_router, discard_router
from .reports import router as reports_router
from .dashboard import router as dashboard_router
