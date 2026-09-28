using api.Models;

namespace api.Services
{
    public interface IWardrobeItemService
    {
        Task<IEnumerable<WardrobeItem>> GetAllAsync();

    }
}
