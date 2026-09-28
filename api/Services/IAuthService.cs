using api.Dtos;
namespace api.Services
{
    public interface IAuthService
    {
        Task<int?> RegisterAsync(RegisterRequest request);
    }
}
