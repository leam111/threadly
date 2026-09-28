using api.Dtos;
using api.Models;
using api.Repositories;
namespace api.Services
{
    public class AuthService:IAuthService
    {

        private readonly IUserRepository _userRepository;



        public AuthService (IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        

        public async Task<int?> RegisterAsync(RegisterRequest request)
        {


            var existingUser = await _userRepository.GetByEmailAsync(request.Email);
            if(existingUser != null)
            {
                return null;
            }


            var user = new User
            {
                Email = request.Email,
                DisplayName = request.DisplayName,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
            };

            return await _userRepository.CreateAsync(user);
        }






    }
}
