using api.Models;
namespace api.Repositories
{
    public interface IUserRepository
    {

        Task<User?> GetByEmailAsync(string email);
        Task<int> CreateAsync(User user);



    }
}
