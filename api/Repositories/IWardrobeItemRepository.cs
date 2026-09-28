using api.Models;

namespace api.Repositories
{
    public interface IWardrobeItemRepository
    {

        Task<IEnumerable<WardrobeItem>> GetAllAsync();

    }
}
