using api.Dtos;
using api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;



        public AuthController (IAuthService authService)
        {
            _authService = authService;
        }



        [HttpPost("register")]
        public async Task<IActionResult>Register(RegisterRequest request)
        {
            var id = await _authService.RegisterAsync(request);

            if (id is null)
            {
                return Conflict(new { message = "Email already used" });
            }
            return Ok(new { id });


        }





    }
}
